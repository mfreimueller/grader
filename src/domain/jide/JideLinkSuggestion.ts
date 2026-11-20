import { fullNameMatches, StudentName } from '../gradeflow/HandinMatcher';
import { normaliseNameTokens } from '../gradeflow/nameNormalisation';
import type { JideCourse, JideStudent } from './JideApi';

/**
 * Which J;DE student belongs to which Grader student, by name. Only unambiguous pairs are suggested: a student with
 * zero or several candidates, or a J;DE student claimed by several students, gets no suggestion.
 * Returns studentId → J;DE student id.
 */
export function suggestStudentLinks(students: StudentName[], jideStudents: JideStudent[]): Map<string, string> {
  const candidates = new Map<string, string[]>();
  const claims = new Map<string, number>();
  for (const student of students) {
    const ids = jideStudents.filter((j) => fullNameMatches(j.name, student)).map((j) => j.id);
    candidates.set(student.id, ids);
    for (const id of ids) claims.set(id, (claims.get(id) ?? 0) + 1);
  }
  const suggestions = new Map<string, string>();
  for (const [studentId, ids] of candidates) {
    const only = ids[0];
    if (ids.length === 1 && only !== undefined && claims.get(only) === 1) suggestions.set(studentId, only);
  }
  return suggestions;
}

const normalised = (text: string): string => normaliseNameTokens(text, 'transliterated').join(' ');

/**
 * The J;DE course of a Grader course: the only one with the same class name; if several share it, the only one
 * whose subject occurs in the course title. Null when that is not unique.
 */
export function suggestCourseLink(
  course: { title: string; className: string },
  jideCourses: JideCourse[],
): string | null {
  const sameClass = jideCourses.filter((j) => normalised(j.className) === normalised(course.className));
  if (sameClass.length === 1) return (sameClass[0] as JideCourse).id;
  const title = normalised(course.title);
  const bySubject = sameClass.filter((j) => normalised(j.subject) !== '' && title.includes(normalised(j.subject)));
  return bySubject.length === 1 ? (bySubject[0] as JideCourse).id : null;
}
