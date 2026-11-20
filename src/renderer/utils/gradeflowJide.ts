// Pure rules of the J;DE source of Gradeflow: choosing the exercise, and showing a hand-in with its line comments.

import type { JideExerciseDto } from '../../shared/jide-api';
import type { LineCommentDto } from '../../shared/gradeflow-api';
import type { JideSendSummary, ReviewJide } from './gradeflowReview';

export type GradeflowSource = 'moodle' | 'jide';

export const describeExercise = (e: JideExerciseDto): string => `${e.title} (${e.slug})`;

/** The exercises whose title or slug contains every word of the query, ignoring case. All of them for an empty query. */
export function filterExercises(exercises: JideExerciseDto[], query: string): JideExerciseDto[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w !== '');
  return exercises.filter((e) => {
    const text = `${e.title} ${e.slug}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export interface JideSetupForm {
  assessmentId: string;
  jideExerciseId: string;
  skillId: string;
}

/** The German names of what the teacher still has to do before a J;DE run can be prepared. */
export function missingJideFields(form: JideSetupForm, linked: boolean): string[] {
  const missing: string[] = [];
  if (!linked) missing.push('J;DE-Verknüpfung');
  if (!form.assessmentId) missing.push('Leistung');
  if (!form.jideExerciseId) missing.push('J;DE-Aufgabe');
  if (!form.skillId) missing.push('Bewertungs-Skill');
  return missing;
}

export interface CodeLine {
  number: number;
  text: string;
  comments: LineCommentDto[];
}

/** A file as numbered lines, each with the line comments that belong to it (the same objects, so edits stick). */
export function codeLines(content: string, path: string, comments: LineCommentDto[]): CodeLine[] {
  const lines = content.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.map((text, index) => ({
    number: index + 1,
    text,
    comments: comments.filter((c) => c.path === path && c.line === index + 1),
  }));
}

/** Line comments whose file or line is not among the shown files; they cannot be shown and are not sent. */
export const strayComments = (jide: ReviewJide): LineCommentDto[] =>
  jide.lineComments.filter((c) => {
    const file = jide.files.find((f) => f.path === c.path);
    return !file || c.line < 1 || c.line > codeLines(file.content, c.path, []).length;
  });

export function describeHandin(jide: ReviewJide): string {
  const parts: string[] = [];
  if (jide.submittedAt) {
    const date = new Date(jide.submittedAt);
    if (!Number.isNaN(date.getTime())) {
      const pad = (n: number): string => String(n).padStart(2, '0');
      parts.push(`Abgegeben am ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`);
    }
  }
  if (jide.late) parts.push('verspätet');
  if (jide.testsPassed !== null && jide.testsTotal !== null) {
    parts.push(`Tests ${jide.testsPassed} von ${jide.testsTotal} bestanden`);
  }
  if (jide.graded) parts.push('in J;DE schon bewertet, wird ersetzt');
  return parts.join(', ');
}

export function describeSendSummary(summary: JideSendSummary): string {
  const parts: string[] = [];
  if (summary.sent > 0) parts.push(`${summary.sent} an J;DE gesendet`);
  if (summary.newerHandin > 0) parts.push(`${summary.newerHandin} nicht gesendet (neue Abgabe seit dem Laden)`);
  if (summary.failed > 0) parts.push(`${summary.failed} nicht gesendet (Fehler)`);
  return parts.join(', ');
}
