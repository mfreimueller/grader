export interface StudentPickCountRepository {
  /** Pick counts per student id; students that were never picked are absent. */
  findByCourse(courseId: string): Promise<Map<string, number>>;
  /** Adds one pick and returns the new count. */
  increment(courseId: string, studentId: string): Promise<number>;
  setCount(courseId: string, studentId: string, count: number): Promise<void>;
  reset(courseId: string): Promise<void>;
}
