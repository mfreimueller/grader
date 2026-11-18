// Which files of a hand-in are copied into the workspace, and how they are treated. Pure rules.

const SKIPPED_SEGMENTS: ReadonlySet<string> = new Set([
  ".git",
  ".svn",
  ".idea",
  ".vscode",
  ".vs",
  "__MACOSX",
  "node_modules",
  "target",
  "bin",
  "obj",
  "build",
  "out",
  ".gradle",
  "__pycache__",
]);

const SKIPPED_BASENAMES: ReadonlySet<string> = new Set([".DS_Store"]);
const SKIPPED_SUFFIXES = [".class", ".pyc"] as const;

const OTHER_ARCHIVE_SUFFIXES = [
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".tgz",
  ".bz2",
  ".xz",
] as const;

/** `relativePath` uses `/` separators (callers normalise). Segment comparison is case-sensitive. */
export function isSkippedPath(relativePath: string): boolean {
  const segments = relativePath.split("/");
  const basename = relativePath.slice(relativePath.lastIndexOf("/") + 1);
  return (
    segments.some((segment) => SKIPPED_SEGMENTS.has(segment)) ||
    SKIPPED_BASENAMES.has(basename) ||
    SKIPPED_SUFFIXES.some((suffix) => basename.endsWith(suffix))
  );
}

export type ContentEncoding =
  | "utf8"
  | "utf16le"
  | "utf16be"
  | "windows-1252"
  | "binary";

// Control bytes that occur in text files: \t \n \f \r.
const TEXT_CONTROLS: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0c, 0x0d]);

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    // stream:true keeps a multi-byte character cut off at the end pending instead of failing.
    new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects how a file's bytes are to be read as text. A UTF-16 BOM wins over NUL bytes; otherwise
 * NUL means binary. Invalid UTF-8 without control bytes is taken to be Windows-1252.
 */
export function classifyContent(head: Uint8Array): ContentEncoding {
  if (head[0] === 0xff && head[1] === 0xfe) return "utf16le";
  if (head[0] === 0xfe && head[1] === 0xff) return "utf16be";
  if (head.includes(0)) return "binary";
  if (isValidUtf8(head)) return "utf8";
  const hasOtherControls = head.some(
    (byte) => (byte < 0x20 && !TEXT_CONTROLS.has(byte)) || byte === 0x7f,
  );
  return hasOtherControls ? "binary" : "windows-1252";
}

export function archiveKind(fileName: string): "zip" | "other-archive" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (OTHER_ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix)))
    return "other-archive";
  return null;
}
