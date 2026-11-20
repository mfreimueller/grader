import { cleanComment, ProposalFlag } from "./CommentCleaning";

export const MAX_LINE_COMMENTS = 200;
export const MAX_LINE_COMMENT_LENGTH = 1000;

export interface JideFileLines {
  /** Keyed by the path as the agent sees it (below `handins/<token>/`). */
  get(scrubbedPath: string): { path: string; lineCount: number } | undefined;
}

export interface LineComment {
  /** Path of the file in the hand-in as J;DE knows it. */
  path: string;
  /** 1-based. */
  line: number;
  text: string;
}

/** Lines of a text the way an editor numbers them: a final line break does not start another line. */
export function countLines(text: string): number {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `./Main.java`, `handins/<token>/Main.java` and backslashes are tolerated; `..` and absolute paths are not. */
function lookupPath(raw: string, token: string): string | null {
  let path = raw.trim().replace(/\\/g, "/");
  const prefix = `handins/${token}/`;
  if (path.startsWith(prefix)) path = path.slice(prefix.length);
  while (path.startsWith("./")) path = path.slice(2);
  if (path === "" || path.startsWith("/") || path.split("/").some((s) => s === "" || s === "..")) return null;
  return path;
}

/**
 * The line comments of one hand-in as the agent wrote them. Comments on files or lines that do not exist are dropped
 * (and flagged), never guessed at; tokens are removed from the text. Returns null when `raw` is not a list.
 */
export function readLineComments(
  raw: unknown,
  files: JideFileLines,
  token: string,
  tokens: string[],
): { comments: LineComment[]; flags: ProposalFlag[] } | null {
  if (raw === undefined) return { comments: [], flags: [] };
  if (!Array.isArray(raw)) return null;

  const flags = new Set<ProposalFlag>();
  const comments: LineComment[] = [];
  for (const entry of raw as unknown[]) {
    if (comments.length >= MAX_LINE_COMMENTS) {
      flags.add("LINE_COMMENT_DROPPED");
      break;
    }
    const comment = readOne(entry, files, token, tokens, flags);
    if (comment === null) flags.add("LINE_COMMENT_DROPPED");
    else comments.push(comment);
  }
  return { comments, flags: [...flags] };
}

function readOne(
  entry: unknown,
  files: JideFileLines,
  token: string,
  tokens: string[],
  flags: Set<ProposalFlag>,
): LineComment | null {
  if (!isRecord(entry) || typeof entry.path !== "string" || typeof entry.text !== "string") return null;
  const { line } = entry;
  if (typeof line !== "number" || !Number.isInteger(line)) return null;
  const lookup = lookupPath(entry.path, token);
  const file = lookup === null ? undefined : files.get(lookup);
  if (file === undefined || line < 1 || line > file.lineCount) return null;

  const cleaned = cleanComment(entry.text, tokens, MAX_LINE_COMMENT_LENGTH);
  for (const flag of cleaned.flags) flags.add(flag);
  return cleaned.comment === "" ? null : { path: file.path, line, text: cleaned.comment };
}
