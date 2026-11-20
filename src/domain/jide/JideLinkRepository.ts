export interface StudentLink {
  studentId: string;
  /** Null removes the link. */
  jideStudentId: string | null;
}

/** The confirmed links between Grader and J;DE. Set up once, reused by every Gradeflow run. */
export interface JideLinkRepository {
  courseLink(courseId: string): Promise<string | null>;
  /** Null removes the link. */
  setCourseLink(courseId: string, jideCourseId: string | null): Promise<void>;
  /** studentId → J;DE student id, for the students that have a link. */
  studentLinks(studentIds: string[]): Promise<Map<string, string>>;
  setStudentLinks(links: StudentLink[]): Promise<void>;
}
