// Fifth wizard step: the proposals the teacher checks, edits and saves.

import type { CurrentResultDto, ProposalsDto, ReviewFlag, SaveResultDto, SaveRow } from '../../shared/gradeflow-api';
import { participationGlyph } from './sessionGridLabels';

export type ReviewGradingType = 'TERTIARY' | 'NUMERIC';
export const MAX_COMMENT_LENGTH = 2000;

export interface ReviewRow {
  studentId: string;
  hasProposal: boolean;
  symbol: string | null;
  score: number | null;
  comment: string;
  flags: ReviewFlag[];
  current: CurrentResultDto | null;
  /** Saving replaces a result that exists already. */
  replaces: boolean;
  include: boolean;
  saved: boolean;
  failure: string | null;
}

export function buildReviewRows(proposals: ProposalsDto, gradingType: ReviewGradingType): ReviewRow[] {
  return proposals.rows.map((r) => ({
    studentId: r.studentId,
    hasProposal: r.proposal !== null,
    symbol: gradingType === 'TERTIARY' ? (r.proposal?.symbol ?? null) : null,
    score: gradingType === 'NUMERIC' ? (r.proposal?.score ?? null) : null,
    comment: r.comment,
    flags: [...r.flags],
    current: r.current ? { ...r.current } : null,
    replaces: r.current !== null,
    include: r.proposal !== null,
    saved: false,
    failure: null,
  }));
}

export function currentLabel(current: CurrentResultDto | null): string {
  if (current?.symbol) return participationGlyph(current.symbol);
  if (current?.score !== null && current?.score !== undefined) return String(current.score).replace('.', ',');
  return '–';
}

export function rowProblem(row: ReviewRow, gradingType: ReviewGradingType, maxPoints: number | null): string | null {
  if (!row.include) return null;
  if (row.comment.length > MAX_COMMENT_LENGTH) return `Der Kommentar darf höchstens ${MAX_COMMENT_LENGTH} Zeichen haben.`;
  if (gradingType === 'TERTIARY') return row.symbol === null ? 'Bitte eine Beurteilung wählen.' : null;
  if (typeof row.score !== 'number' || Number.isNaN(row.score)) return 'Bitte Punkte eingeben.';
  const max = maxPoints ?? Number.POSITIVE_INFINITY;
  if (row.score < 0 || row.score > max) return `Punkte zwischen 0 und ${maxPoints} eingeben.`;
  return null;
}

export function toSaveRows(rows: ReviewRow[], gradingType: ReviewGradingType): SaveRow[] {
  return rows.map((r) => ({
    studentId: r.studentId,
    ...(gradingType === 'TERTIARY' && r.symbol !== null ? { symbol: r.symbol } : {}),
    ...(gradingType === 'NUMERIC' && typeof r.score === 'number' ? { score: r.score } : {}),
    comment: r.comment,
    include: r.include,
  }));
}

/** How many ticked rows would replace a result that exists already. */
export const overwriteCount = (rows: ReviewRow[]): number => rows.filter((r) => r.include && r.replaces).length;

/** After a partly failed save: the saved rows are done, the failed ones stay ticked to be saved again. */
export function applyFailures(rows: ReviewRow[], failed: SaveResultDto['failed']): void {
  const messages = new Map(failed.map((f) => [f.studentId, f.message]));
  for (const row of rows) {
    if (!row.include) continue;
    const message = messages.get(row.studentId);
    if (message === undefined) {
      row.include = false;
      row.saved = true;
      row.failure = null;
    } else {
      row.failure = message;
    }
  }
}
