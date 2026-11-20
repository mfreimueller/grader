import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { MAX_COMMENT_LENGTH } from '../domain/gradeflow/CommentCleaning';
import type { ConfirmedHandin, HandinMatchResult } from '../domain/gradeflow/HandinMatcher';
import { matchJideHandins } from '../domain/gradeflow/JideHandinMatching';
import { MAX_LINE_COMMENT_LENGTH, MAX_LINE_COMMENTS } from '../domain/gradeflow/LineComments';
import type { BuiltWorkspace } from '../domain/gradeflow/HandinWorkspaceBuilder';
import type { PseudonymMap } from '../domain/gradeflow/PseudonymMap';
import type { JideLineComment } from '../domain/jide/JideApi';
import { Result } from '../domain/shared/Result';
import { ValidationError } from '../shared/errors';
import type { JideReviewDto, JideSendDto, LineCommentDto, PrepareJideInput, SaveRow } from '../shared/gradeflow-api';
import type { JideRun, RunState } from './GradeflowRunState';
import type { GradeflowDeps } from './GradeflowTypes';

const invalid = (message: string): Result<never> => Result.fail(new ValidationError(message));

export const JIDE_NOT_AVAILABLE = 'J;DE ist nicht eingerichtet.';
const NOT_LINKED = 'Dieser Kurs ist noch nicht mit einem J;DE-Kurs verknüpft.';
const WRONG_EXERCISE = 'Diese Aufgabe gehört nicht zum verknüpften J;DE-Kurs.';
const NO_HANDINS = 'Zu dieser Aufgabe gibt es noch keine Abgaben.';
export const NEWER_HANDIN_MESSAGE = 'neue Abgabe seit dem Laden';

/**
 * Fetches what a J;DE run needs: the exercise, its package and the latest hand-in of every student, and matches the
 * hand-ins to the course's students through the stored links.
 */
export async function loadJideRun(
  deps: GradeflowDeps,
  input: PrepareJideInput,
  students: RunState['students'],
): Promise<Result<{ jide: JideRun; match: HandinMatchResult }>> {
  const { jide: gateway } = deps;
  if (!gateway) return invalid(JIDE_NOT_AVAILABLE);
  const jideCourseId = await gateway.linkedJideCourseId(input.courseId);
  if (jideCourseId === null) return invalid(NOT_LINKED);
  const api = await gateway.api();
  if (!api.ok) return Result.fail(api.error);

  const exercises = await api.value.listExercises(jideCourseId);
  if (!exercises.ok) return Result.fail(exercises.error);
  const exercise = exercises.value.find((e) => e.id === input.jideExerciseId);
  if (!exercise) return invalid(WRONG_EXERCISE);

  const courses = await api.value.listCourses();
  if (!courses.ok) return Result.fail(courses.error);
  const jideNames = new Map((courses.value.find((c) => c.id === jideCourseId)?.students ?? []).map((s) => [s.id, s.name]));

  const handins = await api.value.listHandins(jideCourseId, exercise.id);
  if (!handins.ok) return Result.fail(handins.error);
  if (handins.value.length === 0) return invalid(NO_HANDINS);
  const packageZip = await api.value.fetchPackage(exercise.id);
  if (!packageZip.ok) return Result.fail(packageZip.error);

  const links = await gateway.studentLinksOf(students.map((s) => s.id));
  const match = matchJideHandins({
    handins: handins.value.map(({ handinId, studentId }) => ({ handinId, studentId })),
    jideNames,
    students,
    links,
  });
  return Result.ok({
    jide: {
      exercise: { id: exercise.id, slug: exercise.slug, title: exercise.title },
      packageZip: packageZip.value,
      handinsById: new Map(handins.value.map((h) => [h.handinId, h])),
      handins: new Map(),
      files: new Map(),
    },
    match,
  });
}

/** Builds the workspace of a confirmed J;DE run and remembers which files each student's hand-in has in it. */
export async function buildJideWorkspace(
  deps: GradeflowDeps,
  run: RunState,
  jide: JideRun,
  confirmed: ConfirmedHandin[],
  pseudonyms: PseudonymMap,
  outputInstructions: string,
): Promise<Result<BuiltWorkspace>> {
  if (!deps.jideWorkspaceBuilder) return invalid(JIDE_NOT_AVAILABLE);
  const handins = confirmed.map((c) => ({ studentId: c.studentId, handin: jide.handinsById.get(c.moodleId) }));
  if (handins.some((h) => h.handin === undefined)) return invalid('Unknown hand-in');

  const built = await deps.jideWorkspaceBuilder.buildJide({
    packageZip: jide.packageZip,
    handins: handins.map((h) => ({ studentId: h.studentId, files: h.handin?.files ?? [] })),
    pseudonyms,
    students: run.students.map(({ firstName, lastName }) => ({ firstName, lastName })),
    outputInstructions,
    skill: { id: run.input.skillId, dir: run.skill.dir },
  });
  if (!built.ok) return Result.fail(built.error);

  jide.handins = new Map(handins.flatMap((h) => (h.handin ? [[h.studentId, h.handin] as const] : [])));
  jide.files = new Map();
  for (const file of built.value.files) {
    const studentId = pseudonyms.studentOf(file.token);
    if (studentId === null) continue;
    const files = jide.files.get(studentId) ?? new Map<string, { path: string; lineCount: number }>();
    files.set(file.path, { path: file.originalPath, lineCount: file.lineCount });
    jide.files.set(studentId, files);
  }
  return Result.ok(built.value);
}

/** The teacher excluded files of a hand-in: they are no longer in the workspace and take no line comments. */
export function forgetExcludedFiles(jide: JideRun, studentId: string, paths: string[]): void {
  const files = jide.files.get(studentId);
  for (const path of paths) files?.delete(path.replace(/\\/g, '/'));
}

/** What the review shows of one J;DE hand-in: its files as the student wrote them, and the line comments. */
export function reviewOf(jide: JideRun, studentId: string, lineComments: LineCommentDto[]): JideReviewDto | undefined {
  const handin = jide.handins.get(studentId);
  if (!handin) return undefined;
  const shown = new Set([...(jide.files.get(studentId)?.values() ?? [])].map((f) => f.path));
  return {
    files: handin.files.filter((f) => shown.has(f.path)).map(({ path, content }) => ({ path, content })),
    lineComments,
    submittedAt: handin.submittedAt,
    late: handin.late,
    testsPassed: handin.testsPassed,
    testsTotal: handin.testsTotal,
    graded: handin.graded,
  };
}

function checkedGrade(
  jide: JideRun,
  row: SaveRow,
): Result<{ symbol: string; comment: string; lineComments: JideLineComment[] }> {
  const symbol = row.symbol === undefined ? null : ParticipationSymbol.create(row.symbol);
  if (!symbol || !symbol.ok) return invalid('Es wurde keine Beurteilung gewählt.');
  const comment = row.comment.trim();
  if (comment.length > MAX_COMMENT_LENGTH) return invalid('Der Kommentar ist zu lang.');

  const lineComments = row.lineComments ?? [];
  if (lineComments.length > MAX_LINE_COMMENTS) return invalid('Es sind zu viele Zeilenkommentare.');
  const files = new Map([...(jide.files.get(row.studentId)?.values() ?? [])].map((f) => [f.path, f.lineCount]));
  const checked: JideLineComment[] = [];
  for (const c of lineComments) {
    const text = c.text.trim();
    const lines = files.get(c.path);
    if (text === '') continue; // an emptied comment is a deleted one
    if (text.length > MAX_LINE_COMMENT_LENGTH) return invalid('Ein Zeilenkommentar ist zu lang.');
    if (lines === undefined || !Number.isInteger(c.line) || c.line < 1 || c.line > lines) {
      return invalid('Ein Zeilenkommentar gehört zu einer Datei oder Zeile, die es nicht gibt.');
    }
    checked.push({ path: c.path, line: c.line, text });
  }
  return Result.ok({ symbol: symbol.value.value, comment, lineComments: checked });
}

/**
 * Sends the included rows to J;DE, one by one. A row J;DE rejects does not stop the others; `NEWER_HANDIN` is
 * reported apart from other errors because the teacher cannot fix it by retrying.
 */
export async function sendToJide(deps: GradeflowDeps, jide: JideRun, rows: SaveRow[]): Promise<JideSendDto[]> {
  const todo = rows.filter((row) => row.include && row.skipJide !== true);
  if (todo.length === 0) return [];
  const failure = (studentId: string, message: string): JideSendDto => ({ studentId, status: 'error', message });

  const api = (await deps.jide?.api()) ?? Result.fail(new ValidationError(JIDE_NOT_AVAILABLE));
  const results: JideSendDto[] = [];
  for (const row of todo) {
    const handin = jide.handins.get(row.studentId);
    if (!api.ok) {
      results.push(failure(row.studentId, api.error.message));
      continue;
    }
    if (!handin) {
      results.push(failure(row.studentId, 'Zu dieser Zeile gibt es keine J;DE-Abgabe.'));
      continue;
    }
    const grade = checkedGrade(jide, row);
    if (!grade.ok) {
      results.push(failure(row.studentId, grade.error.message));
      continue;
    }
    try {
      const sent = await api.value.putGrade(handin.handinId, grade.value);
      if (sent.ok) results.push({ studentId: row.studentId, status: 'sent', message: null });
      else if (sent.error.isNewerHandin) {
        results.push({ studentId: row.studentId, status: 'newer-handin', message: NEWER_HANDIN_MESSAGE });
      } else results.push(failure(row.studentId, sent.error.message));
    } catch {
      results.push(failure(row.studentId, 'Unerwarteter Fehler beim Senden an J;DE.'));
    }
  }
  return results;
}
