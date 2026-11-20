import type { HandinMatchEntry, HandinMatchResult, StudentName } from "./HandinMatcher";

export interface JideMatchInput {
  handins: { handinId: string; studentId: string }[];
  /** J;DE student id → name, from the linked J;DE course. */
  jideNames: ReadonlyMap<string, string>;
  /** The students of the Grader course. */
  students: StudentName[];
  /** Grader student id → J;DE student id: the links the teacher confirmed. */
  links: ReadonlyMap<string, string>;
}

/**
 * Matches the latest hand-ins of a J;DE exercise to Grader students through the stored links, not through names.
 * A hand-in whose J;DE student is linked to nobody is 'unmatched' and is not graded; the teacher fixes the links.
 * The result has the same shape as the Moodle matching, with the J;DE hand-in id in `moodleId`.
 */
export function matchJideHandins(input: JideMatchInput): HandinMatchResult {
  const studentsOf = new Map<string, string[]>();
  for (const student of input.students) {
    const jideId = input.links.get(student.id);
    if (jideId !== undefined) studentsOf.set(jideId, [...(studentsOf.get(jideId) ?? []), student.id]);
  }

  const entries = input.handins.map(({ handinId, studentId }): HandinMatchEntry => {
    const handin = {
      moodleId: handinId,
      fullName: input.jideNames.get(studentId) ?? "Unbekannte J;DE-Person",
      alternativeNames: [],
      folders: [],
    };
    const candidates = studentsOf.get(studentId) ?? [];
    if (candidates.length === 0) return { handin, match: { status: "unmatched" } };
    if (candidates.length > 1) {
      return { handin, match: { status: "ambiguous", reason: "multiple-students", candidateIds: candidates } };
    }
    return { handin, match: { status: "matched", studentId: candidates[0] as string } };
  });

  const withHandin = new Set(
    input.handins.flatMap(({ studentId }) => studentsOf.get(studentId) ?? []),
  );
  return {
    entries,
    studentsWithoutHandin: input.students.map((s) => s.id).filter((id) => !withHandin.has(id)),
    conflicts: [],
    studentIds: input.students.map((s) => s.id),
  };
}
