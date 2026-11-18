import { gradeflowLocation, gradeflowColumnEligible } from '../../../src/renderer/utils/gradeflowRoute';

describe('gradeflowLocation', () => {
  it('opens the wizard of a course without a preselection', () => {
    expect(gradeflowLocation('c1')).toEqual({ name: 'Gradeflow', params: { courseId: 'c1' } });
  });

  it('preselects an assessment through the query', () => {
    expect(gradeflowLocation('c1', 'a1')).toEqual({ name: 'Gradeflow', params: { courseId: 'c1' }, query: { assessmentId: 'a1' } });
  });
});

describe('gradeflowColumnEligible', () => {
  it('accepts TERTIARY and NUMERIC columns only', () => {
    expect(gradeflowColumnEligible('TERTIARY')).toBe(true);
    expect(gradeflowColumnEligible('NUMERIC')).toBe(true);
    expect(gradeflowColumnEligible('GRADE')).toBe(false);
  });
});
