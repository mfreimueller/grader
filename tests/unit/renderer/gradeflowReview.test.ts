import type { ProposalsDto, ReviewRowDto } from '../../../src/shared/gradeflow-api';
import {
  applyFailures,
  buildReviewRows,
  currentLabel,
  overwriteCount,
  rowProblem,
  toSaveRows,
  type ReviewRow,
} from '../../../src/renderer/utils/gradeflowReview';

const dtoRow = (o: Partial<ReviewRowDto> = {}): ReviewRowDto => ({
  studentId: 's1',
  proposal: { symbol: 'WELLE', score: null },
  comment: 'Gut',
  flags: [],
  current: null,
  ...o,
});

const proposals = (rows: ReviewRowDto[]): ProposalsDto => ({ rows, missingStudentIds: [], costUsd: 0.5, durationMs: 1000 });

describe('buildReviewRows', () => {
  it('includes rows that have a proposal and not the ones without', () => {
    const rows = buildReviewRows(proposals([dtoRow(), dtoRow({ studentId: 's2', proposal: null, comment: '' })]), 'TERTIARY');

    expect(rows.map((r) => [r.studentId, r.include])).toEqual([
      ['s1', true],
      ['s2', false],
    ]);
  });

  it('starts from the proposal for a TERTIARY and a NUMERIC assessment', () => {
    const [ter] = buildReviewRows(proposals([dtoRow()]), 'TERTIARY');
    const [num] = buildReviewRows(proposals([dtoRow({ proposal: { symbol: null, score: 7.5 } })]), 'NUMERIC');

    expect(ter).toMatchObject({ symbol: 'WELLE', score: null, comment: 'Gut', hasProposal: true });
    expect(num).toMatchObject({ symbol: null, score: 7.5 });
  });

  it('marks the rows that would replace a result and keeps flags and the current result', () => {
    const [row] = buildReviewRows(
      proposals([dtoRow({ flags: ['TOKEN_IN_COMMENT'], current: { symbol: 'PLUS', score: null, note: 'alt' } })]),
      'TERTIARY',
    );

    expect(row).toMatchObject({ replaces: true, flags: ['TOKEN_IN_COMMENT'], current: { symbol: 'PLUS', note: 'alt' } });
  });

  it('copies the data so later edits never touch the answer of the backend', () => {
    const dto = dtoRow({ flags: ['COMMENT_TRUNCATED'] });
    const [row] = buildReviewRows(proposals([dto]), 'TERTIARY');

    row!.comment = 'geändert';
    row!.flags.push('TOKEN_IN_COMMENT');

    expect(dto.comment).toBe('Gut');
    expect(dto.flags).toEqual(['COMMENT_TRUNCATED']);
  });
});

describe('currentLabel', () => {
  it('describes the existing result and note', () => {
    expect(currentLabel(null)).toBe('–');
    expect(currentLabel({ symbol: 'PLUS_WELLE', score: null, note: null })).toBe('+~');
    expect(currentLabel({ symbol: null, score: 12.5, note: null })).toBe('12,5');
    expect(currentLabel({ symbol: null, score: null, note: null })).toBe('–');
  });
});

describe('rowProblem', () => {
  const row = (o: Partial<ReviewRow> = {}): ReviewRow => ({
    ...buildReviewRows(proposals([dtoRow()]), 'TERTIARY')[0]!,
    ...o,
  });

  it('is null for a valid row', () => {
    expect(rowProblem(row(), 'TERTIARY', null)).toBeNull();
  });

  it('is null for a row that is not included, whatever it holds', () => {
    expect(rowProblem(row({ include: false, symbol: null }), 'TERTIARY', null)).toBeNull();
  });

  it('asks for a result when an included row has none', () => {
    expect(rowProblem(row({ symbol: null }), 'TERTIARY', null)).toBe('Bitte eine Beurteilung wählen.');
    expect(rowProblem(row({ score: null }), 'NUMERIC', 10)).toBe('Bitte Punkte eingeben.');
  });

  it('keeps the points between 0 and the maximum', () => {
    expect(rowProblem(row({ score: 11 }), 'NUMERIC', 10)).toBe('Punkte zwischen 0 und 10 eingeben.');
    expect(rowProblem(row({ score: -1 }), 'NUMERIC', 10)).toBe('Punkte zwischen 0 und 10 eingeben.');
    expect(rowProblem(row({ score: 10 }), 'NUMERIC', 10)).toBeNull();
    expect(rowProblem(row({ score: 0 }), 'NUMERIC', 10)).toBeNull();
    expect(rowProblem(row({ score: Number.NaN }), 'NUMERIC', 10)).toBe('Bitte Punkte eingeben.');
    // An emptied number input yields an empty string, not null.
    expect(rowProblem(row({ score: '' as unknown as number }), 'NUMERIC', 10)).toBe('Bitte Punkte eingeben.');
  });

  it('limits the comment to 2000 characters', () => {
    expect(rowProblem(row({ comment: 'x'.repeat(2001) }), 'TERTIARY', null)).toBe('Der Kommentar darf höchstens 2000 Zeichen haben.');
    expect(rowProblem(row({ comment: 'x'.repeat(2000) }), 'TERTIARY', null)).toBeNull();
  });
});

describe('toSaveRows', () => {
  it('sends the symbol for TERTIARY and the score for NUMERIC, as plain objects', () => {
    const [ter] = buildReviewRows(proposals([dtoRow()]), 'TERTIARY');
    const [num] = buildReviewRows(proposals([dtoRow({ proposal: { symbol: null, score: 4 } })]), 'NUMERIC');

    expect(toSaveRows([ter!], 'TERTIARY')).toEqual([{ studentId: 's1', symbol: 'WELLE', comment: 'Gut', include: true }]);
    expect(toSaveRows([num!], 'NUMERIC')).toEqual([{ studentId: 's1', score: 4, comment: 'Gut', include: true }]);
  });

  it('leaves the result out of a row that has none', () => {
    const [row] = buildReviewRows(proposals([dtoRow({ proposal: null })]), 'TERTIARY');

    expect(toSaveRows([row!], 'TERTIARY')).toEqual([{ studentId: 's1', comment: 'Gut', include: false }]);
  });

  it('does not carry reactive wrappers: the result survives a structured clone', () => {
    const [row] = buildReviewRows(proposals([dtoRow()]), 'TERTIARY');

    expect(() => structuredClone(toSaveRows([row!], 'TERTIARY'))).not.toThrow();
  });
});

describe('overwriteCount', () => {
  it('counts the included rows that replace a result', () => {
    const rows = buildReviewRows(
      proposals([
        dtoRow({ current: { symbol: 'PLUS', score: null, note: null } }),
        dtoRow({ studentId: 's2', current: { symbol: 'PLUS', score: null, note: null } }),
        dtoRow({ studentId: 's3' }),
      ]),
      'TERTIARY',
    );
    rows[1]!.include = false;

    expect(overwriteCount(rows)).toBe(1);
  });
});

describe('applyFailures', () => {
  it('unticks what was saved and keeps the failed rows ticked with their message', () => {
    const rows = buildReviewRows(proposals([dtoRow(), dtoRow({ studentId: 's2' }), dtoRow({ studentId: 's3', proposal: null })]), 'TERTIARY');

    applyFailures(rows, [{ studentId: 's2', message: 'kaputt' }]);

    expect(rows.map((r) => [r.studentId, r.include, r.saved, r.failure])).toEqual([
      ['s1', false, true, null],
      ['s2', true, false, 'kaputt'],
      ['s3', false, false, null],
    ]);
  });
});
