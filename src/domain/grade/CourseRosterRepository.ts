export interface CourseRosterRepository {
  /** Ids of the students the teacher does not teach in this course. */
  findExcludedIds(courseId: string): Promise<Set<string>>;
  setExcluded(courseId: string, studentId: string, excluded: boolean): Promise<void>;
  /** Replaces the whole exclusion list of the course. */
  replaceExcluded(courseId: string, studentIds: readonly string[]): Promise<void>;
  /** Live performances and grades a student has in the course. */
  countEntries(courseId: string, studentId: string): Promise<number>;
}
