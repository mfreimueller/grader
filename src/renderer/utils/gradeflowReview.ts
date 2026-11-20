// Fifth wizard step: the proposals the teacher checks, edits and saves.

import type {
  CurrentResultDto,
  JideReviewDto,
  ProposalsDto,
  ReviewFlag,
  SaveResultDto,
  SaveRow,
} from '../../shared/gradeflow-api';
import { participationGlyph } from './sessionGridLabels';

export type ReviewGradingType = 'TERTIARY' | 'NUMERIC';
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_LINE_COMMENT_LENGTH = 1000;

/** What a J;DE row adds: the code with its (editable) line comments and what happened when it was sent. */
export interface ReviewJide extends JideReviewDto {
  /** `pending` until a save tried it. */
  status: 'pending' | 'sent' | 'newer-handin' | 'error';
  message: string | null;
}

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
  /** Saved in Grader. */
  saved: boolean;
  failure: string | null;
  /** Set for rows of a J;DE run. */
  jide: ReviewJide | null;
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
    jide: r.jide
      ? {
          ...r.jide,
          files: r.jide.files.map((f) => ({ ...f })),
          lineComments: r.jide.lineComments.map((c) => ({ ...c })),
          status: 'pending',
          message: null,
        }
      : null,
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
  if (row.jide?.lineComments.some((c) => c.text.length > MAX_LINE_COMMENT_LENGTH)) {
    return `Ein Zeilenkommentar darf höchstens ${MAX_LINE_COMMENT_LENGTH} Zeichen haben.`;
  }
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
    ...(r.jide
      ? {
          lineComments: r.jide.lineComments.map(({ path, line, text }) => ({ path, line, text })),
          // A retry does only what is still open: Grader has the row, or J;DE has it (or refused it for good).
          skipGrader: r.saved,
          skipJide: r.jide.status === 'sent' || r.jide.status === 'newer-handin',
        }
      : {}),
  }));
}

/** How many ticked rows would replace a result that exists already. */
export const overwriteCount = (rows: ReviewRow[]): number => rows.filter((r) => r.include && r.replaces).length;

/**
 * After a save: a row is done in Grader when it is not among the failed ones. For a J;DE run each row also has the
 * outcome of sending it. Rows stay ticked only while something can still be retried: a failed Grader save or a
 * failed send. A row J;DE refused because of a newer hand-in is final (marked, not ticked).
 */
export function applySaveResult(rows: ReviewRow[], result: SaveResultDto): void {
  const failed = new Map(result.failed.map((f) => [f.studentId, f.message]));
  const sent = new Map((result.jide ?? []).map((s) => [s.studentId, s]));
  for (const row of rows) {
    if (!row.include) continue;
    const message = failed.get(row.studentId);
    row.failure = message ?? null;
    if (message === undefined) row.saved = true;
    const send = sent.get(row.studentId);
    if (row.jide && send) {
      row.jide.status = send.status;
      row.jide.message = send.message;
    }
    row.include = message !== undefined || row.jide?.status === 'error';
  }
}

/** Whether a finished save leaves something the teacher should look at before leaving. */
export const hasOpenJideProblems = (rows: ReviewRow[]): boolean =>
  rows.some((r) => r.jide?.status === 'error' || r.jide?.status === 'newer-handin');

export interface JideSendSummary {
  sent: number;
  newerHandin: number;
  failed: number;
}

export function jideSendSummary(rows: ReviewRow[]): JideSendSummary {
  const count = (status: ReviewJide['status']): number => rows.filter((r) => r.jide?.status === status).length;
  return { sent: count('sent'), newerHandin: count('newer-handin'), failed: count('error') };
}
