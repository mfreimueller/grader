import { changeAssessmentCategorySchema } from '../../../src/main/ipc/schemas';
import { IPC } from '../../../src/shared/ipc-channels';

describe('changeAssessmentCategorySchema', () => {
  it('accepts an assessment id with a category id', () => {
    expect(changeAssessmentCategorySchema.parse({ assessmentId: 'a-1', categoryId: 'c-1' })).toEqual({
      assessmentId: 'a-1',
      categoryId: 'c-1',
    });
  });

  it('rejects a missing or empty assessment id', () => {
    expect(changeAssessmentCategorySchema.safeParse({ categoryId: 'c-1' }).success).toBe(false);
    expect(changeAssessmentCategorySchema.safeParse({ assessmentId: '', categoryId: 'c-1' }).success).toBe(false);
  });

  it('rejects a missing or empty category id', () => {
    expect(changeAssessmentCategorySchema.safeParse({ assessmentId: 'a-1' }).success).toBe(false);
    expect(changeAssessmentCategorySchema.safeParse({ assessmentId: 'a-1', categoryId: '' }).success).toBe(false);
  });

  it('rejects unrelated input', () => {
    expect(changeAssessmentCategorySchema.safeParse(null).success).toBe(false);
  });
});

describe('IPC.ASSESSMENT_CHANGE_CATEGORY', () => {
  it('is the assessment:changeCategory channel', () => {
    expect(IPC.ASSESSMENT_CHANGE_CATEGORY).toBe('assessment:changeCategory');
  });
});
