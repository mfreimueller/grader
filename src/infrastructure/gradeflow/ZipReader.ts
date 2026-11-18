import zlib from "node:zlib";
import yauzl from "yauzl";
import { decodeCp437 } from "../../domain/gradeflow/cp437";
import { Result } from "../../domain/shared/Result";
import { ValidationError } from "../../shared/errors";
import { WorkspaceLimits } from "./WorkspaceLimits";

/** Entry names are normalised to `/` separators. Nothing is ever written by this module. */
export type ZipItem =
  | { kind: "file"; name: string; data: Buffer }
  | {
      kind: "skipped" | "symlink" | "encrypted" | "invalid-path" | "too-large";
      name: string;
    };

const UNIX = 3;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

const failure = (detail: string): Result<ZipItem[]> =>
  Result.fail(new ValidationError(detail));

function isUnsafeName(name: string): boolean {
  return (
    name.includes("\0") ||
    name.startsWith("/") ||
    /^[A-Za-z]:/.test(name) ||
    name.split("/").includes("..")
  );
}

const UTF8_FLAG = 0x0800;
const UNICODE_PATH_FIELD = 0x7075;

/** Info-ZIP Unicode Path field: version 1, CRC-32 of the stored name, then the UTF-8 name. */
function unicodePath(entry: yauzl.Entry, rawName: Buffer): string | null {
  const field = entry.extraFields.find((f) => f.id === UNICODE_PATH_FIELD);
  if (
    field === undefined ||
    field.data.length < 5 ||
    field.data[0] !== 1 ||
    field.data.readUInt32LE(1) !== zlib.crc32(rawName)
  ) {
    return null;
  }
  return field.data.subarray(5).toString("utf8");
}

/** UTF-8 if the flag says so, otherwise CP437 (what Windows Explorer writes). Slashes normalised. */
function entryName(entry: yauzl.Entry): string {
  const raw = entry.fileName as unknown as Buffer; // decodeStrings:false
  const name =
    unicodePath(entry, raw) ??
    ((entry.generalPurposeBitFlag & UTF8_FLAG) !== 0
      ? raw.toString("utf8")
      : decodeCp437(raw));
  return name.replace(/\\/g, "/");
}

function isSymlink(entry: yauzl.Entry): boolean {
  return (
    entry.versionMadeBy >> 8 === UNIX &&
    ((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK
  );
}

/**
 * Reads one entry and counts the bytes actually delivered: more than the declared size aborts the
 * read at once (zip bomb), fewer at the end is corrupt. The caller has already checked the
 * declared size against the limits, so this bounds memory too.
 * yauzl's own `validateEntrySizes` is off on purpose: it reports a mismatch by erroring a stream
 * whose `destroy` it has replaced, so on current Node the error is swallowed and the stream
 * never ends (verified with a deflated entry that expands beyond its declared size).
 */
function readEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer | null> {
  return new Promise((resolve) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return resolve(null);
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      const finish = (data: Buffer | null): void => {
        if (done) return;
        done = true;
        resolve(data);
      };
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > entry.uncompressedSize) {
          stream.destroy();
          return finish(null);
        }
        chunks.push(chunk);
      });
      stream.on("error", () => finish(null));
      stream.on("end", () =>
        finish(size === entry.uncompressedSize ? Buffer.concat(chunks) : null),
      );
    });
  });
}

/**
 * Reads a zip into memory under hard limits: entry count, declared size per file and in total
 * (`readEntry` also counts the bytes actually delivered).
 * `shouldSkip` entries are never read.
 */
export function readZip(
  file: string,
  limits: WorkspaceLimits,
  shouldSkip: (name: string) => boolean,
): Promise<Result<ZipItem[]>> {
  return new Promise((resolve) => {
    // decodeStrings:false → yauzl does not reject unsafe names itself; they are reported per entry.
    yauzl.open(
      file,
      { lazyEntries: true, autoClose: true, decodeStrings: false, validateEntrySizes: false },
      (openError, zip) => {
        if (openError || !zip) return resolve(failure("corrupt archive"));
        if (zip.entryCount > limits.maxArchiveEntries) {
          zip.close();
          return resolve(failure("too many entries"));
        }
        const items: ZipItem[] = [];
        let declaredTotal = 0;
        let settled = false;
        const finish = (result: Result<ZipItem[]>): void => {
          if (settled) return;
          settled = true;
          zip.close();
          resolve(result);
        };
        zip.on("error", () => finish(failure("corrupt archive")));
        zip.on("end", () => finish(Result.ok(items)));
        zip.on("entry", (entry: yauzl.Entry) => {
          handle(entry).then(
            (abort) => (abort ? finish(failure(abort)) : zip.readEntry()),
            () => finish(failure("corrupt archive")),
          );
        });

        /** Resolves to a failure detail when the whole archive must be aborted. */
        async function handle(entry: yauzl.Entry): Promise<string | null> {
          const name = entryName(entry);
          if (name.endsWith("/")) return null; // directory entry
          if (isUnsafeName(name)) {
            items.push({ kind: "invalid-path", name });
          } else if (shouldSkip(name)) {
            items.push({ kind: "skipped", name });
          } else if (isSymlink(entry)) {
            items.push({ kind: "symlink", name });
          } else if (entry.isEncrypted()) {
            items.push({ kind: "encrypted", name });
          } else if (entry.uncompressedSize > limits.maxFileBytes) {
            items.push({ kind: "too-large", name });
          } else {
            declaredTotal += entry.uncompressedSize;
            if (declaredTotal > limits.maxArchiveBytes) return "archive too large";
            const data = await readEntry(zip!, entry);
            if (data === null) return "corrupt archive";
            items.push({ kind: "file", name, data });
          }
          return null;
        }

        zip.readEntry();
      },
    );
  });
}
