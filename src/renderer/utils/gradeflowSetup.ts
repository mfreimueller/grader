// Pure rules of the first wizard step and of the Gradeflow settings.

import type { GradeflowSettingsDto } from '../../shared/gradeflow-api';
import type { AssessmentDto } from '../../shared/types';
import { gradeflowColumnEligible } from './gradeflowRoute';

export interface AssessmentOption {
  id: string;
  label: string;
  gradingType: 'TERTIARY' | 'NUMERIC';
  maxPoints: number | null;
}

const decimalComma = (n: number): string => String(n).replace('.', ',');

function germanDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/** The shared TERTIARY and NUMERIC assessments of a course, oldest first. */
export function eligibleAssessments(assessments: AssessmentDto[]): AssessmentOption[] {
  return assessments
    .filter((a) => !a.isImpromptu && gradeflowColumnEligible(a.category.gradingType))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({
      id: a.id,
      label: `${a.title} (${germanDate(a.date)})`,
      gradingType: a.category.gradingType as AssessmentOption['gradingType'],
      maxPoints: a.maxPoints,
    }));
}

export function describeAssessment(option: AssessmentOption): string {
  if (option.gradingType === 'TERTIARY') return 'Symbole';
  return option.maxPoints === null ? 'Punkte' : `Punkte, max. ${decimalComma(option.maxPoints)}`;
}

export interface SetupForm {
  assessmentId: string;
  assignmentPath: string | null;
  handinsDir: string | null;
  skillId: string;
}

/** The German names of what the teacher still has to choose before the hand-ins can be matched. */
export function missingSetupFields(form: SetupForm): string[] {
  const missing: string[] = [];
  if (!form.assessmentId) missing.push('Leistung');
  if (!form.assignmentPath) missing.push('Aufgabenstellung');
  if (!form.handinsDir) missing.push('Abgabenordner');
  if (!form.skillId) missing.push('Bewertungs-Skill');
  return missing;
}

// The same limits the main process enforces (src/main/gradeflowSettings.ts).
export const BUDGET_LIMITS = { min: 0.1, max: 50 } as const;
export const TIMEOUT_LIMITS = { min: 1, max: 120 } as const;

export function validateGradeflowSettings(settings: GradeflowSettingsDto): Partial<Record<keyof GradeflowSettingsDto, string>> {
  const problems: Partial<Record<keyof GradeflowSettingsDto, string>> = {};
  const { maxBudgetUsd, timeoutMinutes } = settings;
  if (!(maxBudgetUsd >= BUDGET_LIMITS.min && maxBudgetUsd <= BUDGET_LIMITS.max)) {
    problems.maxBudgetUsd = `Bitte einen Betrag zwischen ${decimalComma(BUDGET_LIMITS.min)} und ${BUDGET_LIMITS.max} USD angeben.`;
  }
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < TIMEOUT_LIMITS.min || timeoutMinutes > TIMEOUT_LIMITS.max) {
    problems.timeoutMinutes = `Bitte ganze Minuten zwischen ${TIMEOUT_LIMITS.min} und ${TIMEOUT_LIMITS.max} angeben.`;
  }
  return problems;
}

export function describeLimits(settings: GradeflowSettingsDto): string {
  const minutes = settings.timeoutMinutes === 1 ? '1 Minute' : `${settings.timeoutMinutes} Minuten`;
  return `Höchstens ${decimalComma(settings.maxBudgetUsd)} USD und ${minutes} pro Lauf`;
}
