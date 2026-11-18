import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";
import { Handin } from "./MoodleHandinFolder";
import {
  NAME_VARIANTS,
  NameVariant,
  normaliseNameTokens,
} from "./nameNormalisation";

export interface StudentName {
  id: string;
  firstName: string;
  lastName: string;
}

export type AmbiguityReason =
  "multiple-students" | "student-claimed-by-multiple-handins";

export type HandinMatch =
  | { status: "matched"; studentId: string }
  | { status: "ambiguous"; reason: AmbiguityReason; candidateIds: string[] }
  | { status: "unmatched" };

export interface HandinMatchEntry {
  handin: Handin;
  match: HandinMatch;
}

export interface MatchConflict {
  studentId: string;
  moodleIds: string[];
}

export interface HandinMatchResult {
  entries: HandinMatchEntry[];
  /** Students that are a candidate of no hand-in at all. */
  studentsWithoutHandin: string[];
  /** Students who are the single match of 2+ hand-ins (those entries are 'ambiguous'). */
  conflicts: MatchConflict[];
  /** All student ids that were offered for matching (used to validate overrides). */
  studentIds: string[];
}

export interface ConfirmedHandin {
  moodleId: string;
  studentId: string;
  folders: string[];
}

function matchesIn(
  variant: NameVariant,
  handin: Handin,
  student: StudentName,
): boolean {
  const first = normaliseNameTokens(student.firstName, variant)[0];
  const last = normaliseNameTokens(student.lastName, variant);
  if (first === undefined || last.length === 0) return false;
  const tokens = new Set(normaliseNameTokens(handin.fullName, variant));
  return tokens.has(first) && last.every((token) => tokens.has(token));
}

function isCandidate(handin: Handin, student: StudentName): boolean {
  return NAME_VARIANTS.some((variant) => matchesIn(variant, handin, student));
}

export function matchHandins(
  handins: Handin[],
  students: StudentName[],
): HandinMatchResult {
  const candidates = handins.map((handin) => ({
    handin,
    ids: students
      .filter((student) => isCandidate(handin, student))
      .map((student) => student.id),
  }));

  const claims = new Map<string, string[]>();
  for (const { handin, ids } of candidates) {
    if (ids.length === 1) {
      const studentId = ids[0] as string;
      claims.set(studentId, [
        ...(claims.get(studentId) ?? []),
        handin.moodleId,
      ]);
    }
  }
  const conflicts: MatchConflict[] = [...claims.entries()]
    .filter(([, moodleIds]) => moodleIds.length > 1)
    .map(([studentId, moodleIds]) => ({ studentId, moodleIds }));
  const conflicted = new Set(conflicts.map((conflict) => conflict.studentId));

  const entries = candidates.map(({ handin, ids }): HandinMatchEntry => {
    if (ids.length === 0) return { handin, match: { status: "unmatched" } };
    if (ids.length > 1) {
      return {
        handin,
        match: {
          status: "ambiguous",
          reason: "multiple-students",
          candidateIds: ids,
        },
      };
    }
    const studentId = ids[0] as string;
    if (conflicted.has(studentId)) {
      return {
        handin,
        match: {
          status: "ambiguous",
          reason: "student-claimed-by-multiple-handins",
          candidateIds: ids,
        },
      };
    }
    return { handin, match: { status: "matched", studentId } };
  });

  const withCandidate = new Set(candidates.flatMap(({ ids }) => ids));
  return {
    entries,
    studentsWithoutHandin: students
      .map((s) => s.id)
      .filter((id) => !withCandidate.has(id)),
    conflicts,
    studentIds: students.map((student) => student.id),
  };
}

/**
 * Applies the teacher's manual overrides (moodleId → studentId, or null to skip the hand-in).
 * Hand-ins that are not 'matched' and have no override are skipped (listed as unmatched in the UI).
 */
export function confirmMatches(
  result: HandinMatchResult,
  overrides: ReadonlyMap<string, string | null>,
): Result<ConfirmedHandin[]> {
  const known = new Set(result.studentIds);
  const moodleIds = new Set(
    result.entries.map((entry) => entry.handin.moodleId),
  );
  for (const [moodleId, studentId] of overrides) {
    if (!moodleIds.has(moodleId)) {
      return Result.fail(new ValidationError(`Unknown hand-in: ${moodleId}`));
    }
    if (studentId !== null && !known.has(studentId)) {
      return Result.fail(
        new ValidationError(`Unknown student id: ${studentId}`),
      );
    }
  }

  const confirmed: ConfirmedHandin[] = [];
  const assigned = new Map<string, string>();
  for (const { handin, match } of result.entries) {
    const override = overrides.get(handin.moodleId);
    const studentId =
      override !== undefined
        ? override
        : match.status === "matched"
          ? match.studentId
          : null;
    if (studentId === null) continue;
    const other = assigned.get(studentId);
    if (other !== undefined) {
      return Result.fail(
        new ValidationError(
          `Student ${studentId} is assigned to hand-ins ${other} and ${handin.moodleId}`,
        ),
      );
    }
    assigned.set(studentId, handin.moodleId);
    confirmed.push({
      moodleId: handin.moodleId,
      studentId,
      folders: handin.folders,
    });
  }
  return Result.ok(confirmed);
}
