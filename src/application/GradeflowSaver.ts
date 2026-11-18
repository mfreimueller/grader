import { GradingType } from '../domain/grade/GradingType';
import { MAX_COMMENT_LENGTH } from '../domain/gradeflow/GradingProposal';
import { Result } from '../domain/shared/Result';
import { DomainError, ValidationError } from '../shared/errors';
import type { GradeflowDeps, SaveResultDto, SaveRow } from './GradeflowTypes';

/** Saving would replace results of the assessment; the teacher has to confirm once. */
export class OverwriteNeedsConfirmationError extends ValidationError {
  constructor(readonly count: number) {
    super(`${count} existing result(s) would be replaced`);
  }
}

export interface SaveTarget {
  assessmentId: string;
  gradingType: GradingType;
  /** The students of the run; rows of anybody else are refused. */
  studentIds: string[];
}

type SaverDeps = Pick<GradeflowDeps, 'gradingService' | 'findingService'>;

const failureMessage = (error: unknown): string =>
  // Only domain errors carry a message that is safe to show; anything else may hold names or paths.
  error instanceof DomainError ? error.message : 'Unexpected error';

async function saveRow(deps: SaverDeps, target: SaveTarget, row: SaveRow): Promise<string | null> {
  const numeric = target.gradingType === GradingType.NUMERIC;
  if (numeric ? row.score === undefined : row.symbol === undefined) return 'No result chosen';
  if (row.comment.trim().length > MAX_COMMENT_LENGTH) return 'Comment is too long';

  const recorded = await deps.gradingService.recordPerformance({
    studentId: row.studentId,
    assessmentId: target.assessmentId,
    ...(numeric ? { score: row.score as number } : { symbol: row.symbol as string }),
  });
  if (!recorded.ok) return recorded.error.message;
  // A re-run replaces the comment; a blank one removes it.
  const noted = await deps.findingService.setNote(recorded.value.id, row.comment);
  return noted.ok ? null : `Result saved, comment not: ${noted.error.message}`;
}

/** Writes the included rows. A failing row does not stop the others. */
export async function saveRows(
  deps: SaverDeps,
  target: SaveTarget,
  rows: SaveRow[],
  overwriteConfirmed: boolean,
): Promise<Result<SaveResultDto>> {
  const included = rows.filter((row) => row.include);
  if (included.some((row) => !target.studentIds.includes(row.studentId))) {
    return Result.fail(new ValidationError('A row belongs to a student who is not part of this run'));
  }

  const existing = new Set(
    (await deps.gradingService.getPerformancesByAssessment(target.assessmentId)).map((p) => p.studentId),
  );
  const replaced = included.filter((row) => existing.has(row.studentId)).length;
  if (replaced > 0 && !overwriteConfirmed) {
    return Result.fail(new OverwriteNeedsConfirmationError(replaced));
  }

  let saved = 0;
  const failed: SaveResultDto['failed'] = [];
  for (const row of included) {
    let problem: string | null;
    try {
      problem = await saveRow(deps, target, row);
    } catch (error) {
      problem = failureMessage(error);
    }
    if (problem === null) saved += 1;
    else failed.push({ studentId: row.studentId, message: problem });
  }
  return Result.ok({ saved, failed });
}
