import {
  confirmSchema,
  excludeFilesSchema,
  gradeflowSettingsSchema,
  pickPathSchema,
  prepareSchema,
  runIdSchema,
  saveSchema,
} from '../../../src/main/ipc/gradeflowSchemas';

const prepare = {
  courseId: 'c1',
  assessmentId: 'a1',
  handinsDir: '/in/handins',
  assignmentPath: '/in/a.pdf',
  solutionPath: null,
  skillId: 'beginner',
};

describe('gradeflow schemas', () => {
  describe('prepareSchema', () => {
    it('accepts a request with and without a solution file', () => {
      expect(prepareSchema.safeParse(prepare).success).toBe(true);
      expect(prepareSchema.safeParse({ ...prepare, solutionPath: '/in/s.pdf' }).success).toBe(true);
    });

    it.each(['courseId', 'assessmentId', 'handinsDir', 'assignmentPath', 'skillId'])('rejects an empty %s', (key) => {
      expect(prepareSchema.safeParse({ ...prepare, [key]: '' }).success).toBe(false);
    });

    it('rejects a missing solutionPath and unknown fields are dropped', () => {
      const without: Record<string, unknown> = { ...prepare };
      delete without.solutionPath;
      expect(prepareSchema.safeParse(without).success).toBe(false);
      expect(prepareSchema.parse({ ...prepare, extra: 1 })).not.toHaveProperty('extra');
    });
  });

  describe('runIdSchema', () => {
    it('needs a non-empty run id', () => {
      expect(runIdSchema.safeParse({ runId: 'r' }).success).toBe(true);
      expect(runIdSchema.safeParse({ runId: '' }).success).toBe(false);
      expect(runIdSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('confirmSchema', () => {
    it('accepts overrides with a student or null', () => {
      const value = { runId: 'r', overrides: [{ moodleId: '1', studentId: 's' }, { moodleId: '2', studentId: null }] };
      expect(confirmSchema.safeParse(value).success).toBe(true);
    });

    it('rejects a malformed override', () => {
      expect(confirmSchema.safeParse({ runId: 'r', overrides: [{ moodleId: '1' }] }).success).toBe(false);
      expect(confirmSchema.safeParse({ runId: 'r' }).success).toBe(false);
    });
  });

  describe('excludeFilesSchema', () => {
    it('accepts files and rejects empty paths', () => {
      expect(excludeFilesSchema.safeParse({ runId: 'r', files: [{ studentId: 's', path: 'a.bin' }] }).success).toBe(true);
      expect(excludeFilesSchema.safeParse({ runId: 'r', files: [{ studentId: 's', path: '' }] }).success).toBe(false);
    });
  });

  describe('saveSchema', () => {
    const row = { studentId: 's', symbol: 'PLUS', comment: 'x', include: true };

    it('accepts symbol rows, score rows and rows without a result', () => {
      expect(saveSchema.safeParse({ runId: 'r', overwriteConfirmed: false, rows: [row] }).success).toBe(true);
      expect(saveSchema.safeParse({ runId: 'r', overwriteConfirmed: true, rows: [{ ...row, symbol: undefined, score: 7.5 }] }).success).toBe(true);
      expect(saveSchema.safeParse({ runId: 'r', overwriteConfirmed: false, rows: [{ studentId: 's', comment: '', include: false }] }).success).toBe(true);
    });

    it.each([
      ['a missing include flag', { studentId: 's', comment: '' }],
      ['a non-numeric score', { ...row, score: '7' }],
      ['an infinite score', { ...row, score: Infinity }],
      ['a missing comment', { studentId: 's', include: true }],
    ])('rejects %s', (_label, bad) => {
      expect(saveSchema.safeParse({ runId: 'r', overwriteConfirmed: false, rows: [bad] }).success).toBe(false);
    });

    it('requires the overwrite flag', () => {
      expect(saveSchema.safeParse({ runId: 'r', rows: [row] }).success).toBe(false);
    });
  });

  describe('pickPathSchema', () => {
    it('accepts file and directory pickers with a title', () => {
      expect(pickPathSchema.safeParse({ kind: 'file', title: 'Aufgabe' }).success).toBe(true);
      expect(pickPathSchema.safeParse({ kind: 'directory', title: 'Abgaben' }).success).toBe(true);
    });

    it('rejects other kinds and overlong titles', () => {
      expect(pickPathSchema.safeParse({ kind: 'any', title: 'x' }).success).toBe(false);
      expect(pickPathSchema.safeParse({ kind: 'file', title: 'x'.repeat(201) }).success).toBe(false);
    });
  });

  describe('gradeflowSettingsSchema', () => {
    it('accepts values inside the limits', () => {
      expect(gradeflowSettingsSchema.safeParse({ maxBudgetUsd: 0.1, timeoutMinutes: 1 }).success).toBe(true);
      expect(gradeflowSettingsSchema.safeParse({ maxBudgetUsd: 50, timeoutMinutes: 120 }).success).toBe(true);
    });

    it.each([
      { maxBudgetUsd: 0.05, timeoutMinutes: 15 },
      { maxBudgetUsd: 51, timeoutMinutes: 15 },
      { maxBudgetUsd: 3, timeoutMinutes: 0 },
      { maxBudgetUsd: 3, timeoutMinutes: 121 },
      { maxBudgetUsd: 3, timeoutMinutes: 2.5 },
      { maxBudgetUsd: 3 },
    ])('rejects %j', (value) => {
      expect(gradeflowSettingsSchema.safeParse(value).success).toBe(false);
    });
  });
});
