import fs from "node:fs/promises";
import path from "node:path";
import {
  WorkspaceEntryKind,
  WorkspaceReportEntry,
} from "../../domain/gradeflow/HandinWorkspaceBuilder";
import {
  archiveKind,
  classifyContent,
  ContentEncoding,
  isSkippedPath,
} from "../../domain/gradeflow/handinFileRules";
import {
  LoneNameHit,
  scrubNames,
  ScrubStudent,
} from "../../domain/gradeflow/NameScrubber";
import { WorkspaceLimits } from "./WorkspaceLimits";
import { isStrictlyInside } from "./workspacePaths";
import { readZip, ZipItem } from "./ZipReader";

/** Scrubbed location below `handins/<token>/` plus what scrubbing the names on the way found. */
interface PathState {
  segments: string[];
  replacements: number;
  hits: LoneNameHit[];
}

const ROOT: PathState = { segments: [], replacements: 0, hits: [] };

function mergeHits(a: LoneNameHit[], b: LoneNameHit[]): LoneNameHit[] {
  const merged = new Map<string, number>();
  for (const { name, count } of [...a, ...b]) {
    merged.set(name, (merged.get(name) ?? 0) + count);
  }
  return [...merged].map(([name, count]) => ({ name, count }));
}

const TEXT_DECODER_LABEL = {
  utf16le: "utf-16le",
  utf16be: "utf-16be",
  "windows-1252": "windows-1252",
} as const;

function decodeText(data: Buffer, encoding: Exclude<ContentEncoding, "binary">): string {
  if (encoding === "utf8") return data.toString("utf8");
  return new TextDecoder(TEXT_DECODER_LABEL[encoding]).decode(data);
}

const lower = (segments: string[]): string => segments.join("/").toLowerCase();

/** Copies the folders of one hand-in into `handins/<token>/`, scrubbing names on the way. */
export class HandinCopier {
  private readonly taken = new Map<string, "file" | "dir">();

  constructor(
    private readonly token: string,
    private readonly tokenDir: string,
    private readonly students: ScrubStudent[],
    private readonly limits: WorkspaceLimits,
    private readonly report: WorkspaceReportEntry[],
  ) {}

  async copyFolder(folder: string): Promise<void> {
    await this.walk(folder, ROOT);
  }

  // ---- scrubbed names and collisions --------------------------------------------------------

  private scrub(name: string, base: PathState): { segment: string; state: PathState } {
    const scrubbed = scrubNames(name, this.students);
    return {
      segment: scrubbed.text,
      state: {
        segments: base.segments,
        replacements: base.replacements + scrubbed.replacements,
        hits: mergeHits(base.hits, scrubbed.loneNameHits),
      },
    };
  }

  private numbered(segment: string, isFile: boolean, attempt: number): string {
    const extension = isFile ? path.posix.extname(segment) : "";
    const stem = segment.slice(0, segment.length - extension.length);
    return `${stem} (${attempt})${extension}`;
  }

  private claim(parent: string[], segment: string, kind: "file" | "dir"): string {
    let candidate = segment;
    for (let attempt = 2; ; attempt++) {
      const existing = this.taken.get(lower([...parent, candidate]));
      if (existing === undefined || (existing === "dir" && kind === "dir")) break;
      candidate = this.numbered(segment, kind === "file", attempt);
    }
    this.taken.set(lower([...parent, candidate]), kind);
    return candidate;
  }

  private absolute(segments: string[]): string {
    const target = path.join(this.tokenDir, ...segments);
    if (!isStrictlyInside(this.tokenDir, target)) {
      throw new Error("Path escapes the hand-in directory");
    }
    return target;
  }

  private async enterDir(name: string, base: PathState): Promise<PathState> {
    const { segment, state } = this.scrub(name, base);
    const claimed = this.claim(base.segments, segment, "dir");
    const segments = [...base.segments, claimed];
    await fs.mkdir(this.absolute(segments), { recursive: true });
    return { ...state, segments };
  }

  // ---- report -------------------------------------------------------------------------------

  private add(
    segments: string[],
    kind: WorkspaceEntryKind,
    extra: Partial<Omit<WorkspaceReportEntry, "token" | "path" | "kind">> = {},
  ): void {
    this.report.push({ token: this.token, path: segments.join("/"), kind, ...extra });
  }

  private hitsOf(state: PathState): Partial<WorkspaceReportEntry> {
    return {
      ...(state.replacements > 0 ? { replacements: state.replacements } : {}),
      ...(state.hits.length > 0 ? { loneNameHits: state.hits } : {}),
    };
  }

  /** Scrubbed path without claiming names: for entries that are not copied. */
  private plain(name: string | string[], base: PathState): string[] {
    const names = typeof name === "string" ? [name] : name;
    return [...base.segments, ...names.map((n) => scrubNames(n, this.students).text)];
  }

  // ---- directory tree -----------------------------------------------------------------------

  private async walk(dir: string, base: PathState): Promise<void> {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (isSkippedPath(entry.name)) {
        this.add(this.plain(entry.name, base), "skipped");
      } else if (entry.isSymbolicLink()) {
        this.add(this.plain(entry.name, base), "symlink");
      } else if (entry.isDirectory()) {
        await this.walk(abs, await this.enterDir(entry.name, base));
      } else if (entry.isFile()) {
        await this.copyFile(abs, entry.name, base);
      } else {
        this.add(this.plain(entry.name, base), "skipped", { detail: "not a regular file" });
      }
    }
  }

  private async copyFile(abs: string, name: string, base: PathState): Promise<void> {
    const kind = archiveKind(name);
    if (kind === "zip") return this.extractZip(abs, name, base);
    if (kind === "other-archive") {
      return this.add(this.plain(name, base), "unsupported-archive");
    }
    const { size } = await fs.lstat(abs);
    const data = size > this.limits.maxFileBytes ? null : await fs.readFile(abs);
    if (data === null || data.length > this.limits.maxFileBytes) {
      return this.add(this.plain(name, base), "too-large");
    }
    await this.store(name, data, base, "regular");
  }

  /** Scrubs and writes one file; text is rewritten, anything else is copied byte for byte. */
  private async store(
    name: string,
    data: Buffer,
    base: PathState,
    as: "regular" | "nested-archive",
  ): Promise<void> {
    const { segment, state } = this.scrub(name, base);
    const segments = [...base.segments, this.claim(base.segments, segment, "file")];
    const target = this.absolute(segments);
    const encoding = as === "regular" ? classifyContent(data) : "binary";
    if (encoding !== "binary") {
      // Always written back as UTF-8 (a UTF-8 BOM is kept, UTF-16 BOMs are dropped).
      const content = scrubNames(decodeText(data, encoding), this.students);
      await fs.writeFile(target, content.text, "utf8");
      this.add(segments, "text", {
        replacements: state.replacements + content.replacements,
        loneNameHits: mergeHits(state.hits, content.loneNameHits),
        ...(encoding === "utf8" ? {} : { detail: `converted from ${encoding}` }),
      });
      return;
    }
    await fs.writeFile(target, data);
    this.add(segments, as === "regular" ? "binary" : "nested-archive", this.hitsOf(state));
  }

  // ---- zip ----------------------------------------------------------------------------------

  private async extractZip(abs: string, name: string, base: PathState): Promise<void> {
    const archive = await readZip(abs, this.limits, isSkippedPath);
    if (!archive.ok) {
      return this.add(this.plain(name, base), "archive-error", {
        detail: archive.error.message,
      });
    }
    const stem = name.slice(0, -".zip".length);
    const root = await this.enterDir(stem === "" ? "archive" : stem, base);
    const reportedSkips = new Set<string>();
    for (const item of archive.value) {
      await this.zipItem(item, root, reportedSkips);
    }
  }

  private async zipItem(
    item: ZipItem,
    root: PathState,
    reportedSkips: Set<string>,
  ): Promise<void> {
    const names = item.name.split("/").filter((s) => s !== "" && s !== ".");
    if (item.kind === "invalid-path" || names.length === 0) {
      return this.add(this.plain(item.name, root), "archive-error", {
        detail: "unsafe path",
      });
    }
    if (item.kind === "skipped") return this.zipSkipped(names, root, reportedSkips);

    const fileName = names[names.length - 1] ?? "";
    const outside = this.plain(names, root);
    if (item.kind !== "file") {
      if (item.kind === "encrypted") {
        return this.add(outside, "archive-error", { detail: "encrypted" });
      }
      return this.add(outside, item.kind === "symlink" ? "symlink" : "too-large");
    }

    const kind = archiveKind(fileName);
    if (kind === "other-archive") return this.add(outside, "unsupported-archive");
    let parent = root;
    for (const dirName of names.slice(0, -1)) parent = await this.enterDir(dirName, parent);
    await this.store(fileName, item.data, parent, kind === "zip" ? "nested-archive" : "regular");
  }

  private zipSkipped(names: string[], root: PathState, reported: Set<string>): void {
    const end = names.findIndex((_, i) => isSkippedPath(names.slice(0, i + 1).join("/")));
    const shown = this.plain(names.slice(0, end < 0 ? names.length : end + 1), root);
    const key = shown.join("/");
    if (reported.has(key)) return;
    reported.add(key);
    this.add(shown, "skipped");
  }
}
