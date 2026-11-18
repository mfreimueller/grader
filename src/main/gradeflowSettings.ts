import type { GradeflowSettingsDto } from '../shared/gradeflow-api';
import type { Settings } from './settings';

export const MIN_BUDGET_USD = 0.1;
export const MAX_BUDGET_USD = 50;
export const MIN_TIMEOUT_MINUTES = 1;
export const MAX_TIMEOUT_MINUTES = 120;

export const DEFAULT_GRADEFLOW_SETTINGS: GradeflowSettingsDto = { maxBudgetUsd: 3, timeoutMinutes: 15 };

const isBudget = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= MIN_BUDGET_USD && value <= MAX_BUDGET_USD;

const isTimeout = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_TIMEOUT_MINUTES && value <= MAX_TIMEOUT_MINUTES;

export function isValidGradeflowSettings(value: GradeflowSettingsDto): boolean {
  return isBudget(value.maxBudgetUsd) && isTimeout(value.timeoutMinutes);
}

/** The stored values; each one that is missing, hand-edited to nonsense or out of range falls back to its default. */
export function readGradeflowSettings(settings: Settings): GradeflowSettingsDto {
  const stored: Partial<Record<keyof GradeflowSettingsDto, unknown>> = settings.gradeflow ?? {};
  return {
    maxBudgetUsd: isBudget(stored.maxBudgetUsd) ? stored.maxBudgetUsd : DEFAULT_GRADEFLOW_SETTINGS.maxBudgetUsd,
    timeoutMinutes: isTimeout(stored.timeoutMinutes)
      ? stored.timeoutMinutes
      : DEFAULT_GRADEFLOW_SETTINGS.timeoutMinutes,
  };
}

export function toRunSettings(settings: Settings): { maxBudgetUsd: number; timeoutMs: number } {
  const { maxBudgetUsd, timeoutMinutes } = readGradeflowSettings(settings);
  return { maxBudgetUsd, timeoutMs: timeoutMinutes * 60 * 1000 };
}

export function withGradeflowSettings(current: Settings, gradeflow: GradeflowSettingsDto): Settings {
  return { ...current, gradeflow };
}
