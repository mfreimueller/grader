import { GradeComposition } from '../../../../src/domain/grade/GradeComposition';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { SubWeightType } from '../../../../src/domain/grade/SubWeightType';

describe('GradeComposition', () => {
  const category = new AssessmentCategory('cat-1', 'Mitarbeit', GradingType.TERTIARY, false);

  describe('create', () => {
    it('creates with valid category and weight', () => {
      const result = GradeComposition.create(category, 50);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.assessmentCategory.id).toBe('cat-1');
        expect(result.value.weight).toBe(50);
        expect(result.value.subWeightType).toBe(SubWeightType.NONE);
      }
    });

    it('accepts weight of 1', () => {
      const result = GradeComposition.create(category, 1);
      expect(result.ok).toBe(true);
    });

    it('accepts weight of 99', () => {
      const result = GradeComposition.create(category, 99);
      expect(result.ok).toBe(true);
    });

    it('creates with CHRONOLOGICAL subWeightType', () => {
      const result = GradeComposition.create(category, 50, SubWeightType.CHRONOLOGICAL);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.subWeightType).toBe(SubWeightType.CHRONOLOGICAL);
      }
    });

    it('defaults to NONE subWeightType', () => {
      const result = GradeComposition.create(category, 50);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.subWeightType).toBe(SubWeightType.NONE);
      }
    });
  });

  describe('validation', () => {
    it('rejects weight of 0', () => {
      const result = GradeComposition.create(category, 0);
      expect(result.ok).toBe(false);
    });

    it('rejects weight of 100', () => {
      const result = GradeComposition.create(category, 100);
      expect(result.ok).toBe(false);
    });

    it('rejects negative weight', () => {
      const result = GradeComposition.create(category, -10);
      expect(result.ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for same category, weight and subWeightType', () => {
      const a = GradeComposition.create(category, 50);
      const b = GradeComposition.create(category, 50);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different weights', () => {
      const a = GradeComposition.create(category, 50);
      const b = GradeComposition.create(category, 60);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });

    it('returns false for different subWeightTypes', () => {
      const a = GradeComposition.create(category, 50, SubWeightType.NONE);
      const b = GradeComposition.create(category, 50, SubWeightType.CHRONOLOGICAL);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
