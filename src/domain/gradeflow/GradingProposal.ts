import { GradingType } from "../grade/GradingType";
import { ParticipationSymbol } from "../grade/ParticipationSymbol";
import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";
import { cleanComment, MAX_COMMENT_LENGTH, ProposalFlag } from "./CommentCleaning";
import { JideFileLines, LineComment, readLineComments } from "./LineComments";
import { PseudonymMap } from "./PseudonymMap";

export { MAX_COMMENT_LENGTH };
export type { ProposalFlag };

export interface GradingProposalContext {
  gradingType: GradingType;
  maxPoints: number | null;
  pseudonyms: PseudonymMap;
  /**
   * J;DE runs: the files of each hand-in (by student id). When set, every result may carry `lineComments`, which
   * are checked against these files.
   */
  jideFiles?: ReadonlyMap<string, JideFileLines>;
}

export interface Proposal {
  studentId: string;
  symbol: string | null;
  score: number | null;
  comment: string;
  flags: ProposalFlag[];
  /** Only for J;DE runs (`jideFiles` given). */
  lineComments?: LineComment[];
}

export interface ParsedGradingProposal {
  proposals: Proposal[];
  missingStudentIds: string[];
}

const fail = (message: string): Result<never> =>
  Result.fail(new ValidationError(message));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Rule = { kind: "tertiary" } | { kind: "numeric"; maxPoints: number };

function ruleOf(context: GradingProposalContext): Result<Rule> {
  if (context.gradingType === GradingType.TERTIARY)
    return Result.ok({ kind: "tertiary" });
  if (context.maxPoints === null)
    return fail("NUMERIC grading needs maxPoints");
  return Result.ok({ kind: "numeric", maxPoints: context.maxPoints });
}

function readResult(
  entry: Record<string, unknown>,
  where: string,
  rule: Rule,
): Result<{ symbol: string | null; score: number | null }> {
  if (rule.kind === "tertiary") {
    const symbol =
      typeof entry.symbol === "string"
        ? ParticipationSymbol.create(entry.symbol)
        : null;
    if (!symbol || !symbol.ok) {
      return fail(`${where}: symbol must be one of the participation symbols`);
    }
    return Result.ok({ symbol: symbol.value.value, score: null });
  }
  const { score } = entry;
  // Same range rule as GradedPerformance (0..maxPoints, fractions allowed), and finite.
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > rule.maxPoints
  ) {
    return fail(
      `${where}: score must be a number between 0 and ${rule.maxPoints}`,
    );
  }
  return Result.ok({ symbol: null, score });
}

export function parseGradingProposal(
  raw: unknown,
  context: GradingProposalContext,
): Result<ParsedGradingProposal> {
  if (!isRecord(raw)) return fail("Grading result must be an object");
  if (raw.version !== 1)
    return fail("Unsupported grading result version (expected 1)");
  if (!Array.isArray(raw.results))
    return fail("Grading result: results must be an array");
  const rule = ruleOf(context);
  if (!rule.ok) return Result.fail(rule.error);

  const tokens = context.pseudonyms.tokens();
  const seen = new Set<string>();
  const proposals: Proposal[] = [];
  for (const [index, entry] of (raw.results as unknown[]).entries()) {
    const where = `results[${index}]`;
    if (!isRecord(entry)) return fail(`${where} must be an object`);
    if (typeof entry.token !== "string")
      return fail(`${where}: token must be a string`);
    const studentId = context.pseudonyms.studentOf(entry.token);
    if (studentId === null) return fail(`${where}: Unknown token`);
    if (seen.has(entry.token)) return fail(`${where}: Duplicate token`);
    seen.add(entry.token);
    if (typeof entry.comment !== "string")
      return fail(`${where}: comment must be a string`);

    const outcome = readResult(entry, where, rule.value);
    if (!outcome.ok) return Result.fail(outcome.error);
    const { comment, flags } = cleanComment(entry.comment, tokens);
    if (context.jideFiles === undefined) {
      proposals.push({ studentId, ...outcome.value, comment, flags });
      continue;
    }
    const files = context.jideFiles.get(studentId) ?? new Map();
    const lines = readLineComments(entry.lineComments, files, entry.token, tokens);
    if (lines === null) return fail(`${where}: lineComments must be an array`);
    proposals.push({
      studentId,
      ...outcome.value,
      comment,
      flags: [...new Set([...flags, ...lines.flags])],
      lineComments: lines.comments,
    });
  }

  const answered = new Set(proposals.map((proposal) => proposal.studentId));
  return Result.ok({
    proposals,
    missingStudentIds: context.pseudonyms
      .studentIds()
      .filter((id) => !answered.has(id)),
  });
}
