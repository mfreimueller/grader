import {
  DEFAULT_GRADEFLOW_SETTINGS,
  isValidGradeflowSettings,
  toRunSettings,
  withGradeflowSettings,
} from '../../../src/main/gradeflowSettings';

describe('gradeflow settings', () => {
  describe('DEFAULT_GRADEFLOW_SETTINGS', () => {
    it('allows 3 USD and 15 minutes per run', () => {
      expect(DEFAULT_GRADEFLOW_SETTINGS).toEqual({ maxBudgetUsd: 3, timeoutMinutes: 15 });
    });
  });

  describe('withGradeflowSettings', () => {
    it('stores the values and keeps unrelated settings', () => {
      const result = withGradeflowSettings({ mcpEnabled: true }, { maxBudgetUsd: 5, timeoutMinutes: 30 });

      expect(result).toEqual({ mcpEnabled: true, gradeflow: { maxBudgetUsd: 5, timeoutMinutes: 30 } });
    });
  });

  describe('toRunSettings', () => {
    it('uses the defaults when nothing is stored', () => {
      expect(toRunSettings({})).toEqual({ maxBudgetUsd: 3, timeoutMs: 15 * 60 * 1000 });
    });

    it('converts stored minutes to milliseconds', () => {
      expect(toRunSettings({ gradeflow: { maxBudgetUsd: 0.5, timeoutMinutes: 2 } })).toEqual({
        maxBudgetUsd: 0.5,
        timeoutMs: 120_000,
      });
    });

    it('falls back to the default for each invalid or out-of-range stored value', () => {
      const broken = { maxBudgetUsd: 999, timeoutMinutes: 'soon' } as unknown as { maxBudgetUsd: number; timeoutMinutes: number };

      expect(toRunSettings({ gradeflow: broken })).toEqual({ maxBudgetUsd: 3, timeoutMs: 15 * 60 * 1000 });
      expect(toRunSettings({ gradeflow: { maxBudgetUsd: 0.05, timeoutMinutes: 0 } })).toEqual({
        maxBudgetUsd: 3,
        timeoutMs: 15 * 60 * 1000,
      });
    });

    it('keeps one valid value when the other is invalid', () => {
      const partial = { maxBudgetUsd: 10, timeoutMinutes: Number.NaN };

      expect(toRunSettings({ gradeflow: partial })).toEqual({ maxBudgetUsd: 10, timeoutMs: 15 * 60 * 1000 });
    });
  });

  describe('isValidGradeflowSettings', () => {
    it.each([
      [{ maxBudgetUsd: 0.1, timeoutMinutes: 1 }, true],
      [{ maxBudgetUsd: 50, timeoutMinutes: 120 }, true],
      [{ maxBudgetUsd: 0.09, timeoutMinutes: 15 }, false],
      [{ maxBudgetUsd: 50.1, timeoutMinutes: 15 }, false],
      [{ maxBudgetUsd: 3, timeoutMinutes: 0 }, false],
      [{ maxBudgetUsd: 3, timeoutMinutes: 121 }, false],
      [{ maxBudgetUsd: 3, timeoutMinutes: 1.5 }, false],
      [{ maxBudgetUsd: Number.NaN, timeoutMinutes: 15 }, false],
    ])('%j -> %s', (value, expected) => {
      expect(isValidGradeflowSettings(value)).toBe(expected);
    });
  });
});
