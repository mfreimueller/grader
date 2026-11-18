import type { AssessmentDto } from '../../../src/shared/types';
import {
  describeAssessment,
  describeLimits,
  eligibleAssessments,
  missingSetupFields,
  validateGradeflowSettings,
} from '../../../src/renderer/utils/gradeflowSetup';

const anAssessment = (o: Partial<AssessmentDto> & { gradingType?: string } = {}): AssessmentDto => {
  const { gradingType = 'NUMERIC', ...rest } = o;
  return {
    id: 'a1',
    title: 'Test 1',
    date: '2026-10-05T00:00:00.000Z',
    category: { id: 'c', title: 'Tests', gradingType, displayAsGrade: false, isHidden: false },
    courseId: 'course',
    isImpromptu: false,
    maxPoints: 20,
    ...rest,
  };
};

describe('eligibleAssessments', () => {
  it('keeps shared TERTIARY and NUMERIC assessments only', () => {
    const list = eligibleAssessments([
      anAssessment({ id: 'num' }),
      anAssessment({ id: 'ter', gradingType: 'TERTIARY', maxPoints: null }),
      anAssessment({ id: 'imp', isImpromptu: true }),
      anAssessment({ id: 'grade', gradingType: 'GRADE' }),
    ]);

    expect(list.map((a) => a.id)).toEqual(['num', 'ter']);
  });

  it('orders by date, oldest first, and formats the date the Austrian way', () => {
    const list = eligibleAssessments([
      anAssessment({ id: 'late', date: '2026-11-20T00:00:00.000Z' }),
      anAssessment({ id: 'early', date: '2026-09-02T00:00:00.000Z' }),
    ]);

    expect(list.map((a) => a.id)).toEqual(['early', 'late']);
    expect(list[0]?.label).toBe('Test 1 (02.09.2026)');
  });

  it('shows the type and the maximum of points', () => {
    const [numeric, tertiary] = eligibleAssessments([
      anAssessment({ maxPoints: 12.5 }),
      anAssessment({ id: 't', gradingType: 'TERTIARY', maxPoints: null }),
    ]);

    expect(describeAssessment(numeric!)).toBe('Punkte, max. 12,5');
    expect(describeAssessment(tertiary!)).toBe('Symbole');
  });

  it('shows no maximum for a NUMERIC assessment that has none', () => {
    const [option] = eligibleAssessments([anAssessment({ maxPoints: null })]);

    expect(describeAssessment(option!)).toBe('Punkte');
  });
});

describe('missingSetupFields', () => {
  const full = { assessmentId: 'a', assignmentPath: '/a.pdf', handinsDir: '/in', skillId: 's' };

  it('is empty when everything needed is chosen', () => {
    expect(missingSetupFields(full)).toEqual([]);
  });

  it('names every missing field in German', () => {
    expect(missingSetupFields({ assessmentId: '', assignmentPath: null, handinsDir: null, skillId: '' })).toEqual([
      'Leistung',
      'Aufgabenstellung',
      'Abgabenordner',
      'Bewertungs-Skill',
    ]);
  });
});

describe('validateGradeflowSettings', () => {
  it('accepts values inside the limits', () => {
    expect(validateGradeflowSettings({ maxBudgetUsd: 0.1, timeoutMinutes: 1 })).toEqual({});
    expect(validateGradeflowSettings({ maxBudgetUsd: 50, timeoutMinutes: 120 })).toEqual({});
  });

  it('explains values outside the limits', () => {
    const problems = validateGradeflowSettings({ maxBudgetUsd: 51, timeoutMinutes: 0 });

    expect(problems.maxBudgetUsd).toBe('Bitte einen Betrag zwischen 0,1 und 50 USD angeben.');
    expect(problems.timeoutMinutes).toBe('Bitte ganze Minuten zwischen 1 und 120 angeben.');
  });

  it('refuses fractions of a minute and values that are not numbers', () => {
    expect(validateGradeflowSettings({ maxBudgetUsd: Number.NaN, timeoutMinutes: 1.5 })).toEqual({
      maxBudgetUsd: expect.any(String),
      timeoutMinutes: expect.any(String),
    });
  });
});

describe('describeLimits', () => {
  it('writes the limits of a run with a decimal comma', () => {
    expect(describeLimits({ maxBudgetUsd: 3, timeoutMinutes: 15 })).toBe('Höchstens 3 USD und 15 Minuten pro Lauf');
    expect(describeLimits({ maxBudgetUsd: 2.5, timeoutMinutes: 1 })).toBe('Höchstens 2,5 USD und 1 Minute pro Lauf');
  });
});
