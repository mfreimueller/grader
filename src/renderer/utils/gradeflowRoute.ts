// Where the Gradeflow wizard lives and which assessments may be graded with it.

export const GRADEFLOW_ROUTE = 'Gradeflow';

export function gradeflowLocation(
  courseId: string,
  assessmentId?: string,
): { name: string; params: { courseId: string }; query?: { assessmentId: string } } {
  const base = { name: GRADEFLOW_ROUTE, params: { courseId } };
  return assessmentId === undefined ? base : { ...base, query: { assessmentId } };
}

/** Gradeflow proposes symbols or points, so only these grading types qualify. */
export function gradeflowColumnEligible(gradingType: string): boolean {
  return gradingType === 'TERTIARY' || gradingType === 'NUMERIC';
}
