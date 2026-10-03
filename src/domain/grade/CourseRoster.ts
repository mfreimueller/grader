import { Student } from '../student/Student';

/**
 * Who belongs to a course: the live students of its class except those the teacher does not teach.
 * One rule for every consumer (grading, sessions, picker, reports).
 */
export const CourseRoster = {
  of(classStudents: readonly Student[], excludedIds: ReadonlySet<string>): Student[] {
    return classStudents
      .filter((s) => s.deletedAt === null && !excludedIds.has(s.id.value))
      .sort(
        (a, b) =>
          a.name.lastName.localeCompare(b.name.lastName) || a.name.firstName.localeCompare(b.name.firstName),
      );
  },
} as const;
