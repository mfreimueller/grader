/** Same limit as Grader's other notes (SessionService.STUDENT_NOTE_MAX_LENGTH, plugin notes). */
export const MAX_COMMENT_LENGTH = 2000;

export type ProposalFlag =
  | "TOKEN_IN_COMMENT"
  | "COMMENT_TRUNCATED"
  /** J;DE runs: a line comment pointed at a file or line that does not exist, or was empty or surplus. */
  | "LINE_COMMENT_DROPPED";

export function cleanComment(
  raw: string,
  tokens: string[],
  maxLength: number = MAX_COMMENT_LENGTH,
): { comment: string; flags: ProposalFlag[] } {
  const flags: ProposalFlag[] = [];
  let comment = raw.trim();
  if (tokens.length > 0) {
    let found = false;
    comment = comment
      .replace(new RegExp(tokens.join("|"), "gi"), () => {
        found = true;
        return "";
      })
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (found) flags.push("TOKEN_IN_COMMENT");
  }
  if (comment.length > maxLength) {
    let end = maxLength;
    const last = comment.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end--; // do not cut a surrogate pair in half
    comment = comment.slice(0, end).trimEnd();
    flags.push("COMMENT_TRUNCATED");
  }
  return { comment, flags };
}

