import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';

describe('AssessmentCategory', () => {
  describe('create', () => {
    it('creates with id, title, gradingType, and displayAsGrade', () => {
      const cat = new AssessmentCategory('cat-1', 'Mitarbeit', GradingType.TERTIARY, false);
      expect(cat.id).toBe('cat-1');
      expect(cat.title).toBe('Mitarbeit');
      expect(cat.gradingType).toBe(GradingType.TERTIARY);
      expect(cat.displayAsGrade).toBe(false);
    });
  });

  describe('updateGradingType', () => {
    it('changes the grading type', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.TERTIARY, false);
      cat.updateGradingType(GradingType.NUMERIC);
      expect(cat.gradingType).toBe(GradingType.NUMERIC);
    });
  });

  describe('toggleDisplayAsGrade', () => {
    it('toggles from false to true', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, false);
      cat.toggleDisplayAsGrade();
      expect(cat.displayAsGrade).toBe(true);
    });

    it('toggles from true to false', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, true);
      cat.toggleDisplayAsGrade();
      expect(cat.displayAsGrade).toBe(false);
    });
  });

  describe('isHidden', () => {
    it('defaults to false when not specified', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, false);
      expect(cat.isHidden).toBe(false);
    });

    it('can be set to true via constructor', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, false, true);
      expect(cat.isHidden).toBe(true);
    });

    it('can be set to false via constructor', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, false, false);
      expect(cat.isHidden).toBe(false);
    });

    it('toggles from false to true', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, false);
      cat.toggleHidden();
      expect(cat.isHidden).toBe(true);
    });

    it('toggles from true to false', () => {
      const cat = new AssessmentCategory('cat-1', 'Test', GradingType.NUMERIC, false, true);
      cat.toggleHidden();
      expect(cat.isHidden).toBe(false);
    });
  });
});
