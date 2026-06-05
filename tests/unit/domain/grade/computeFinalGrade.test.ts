import {
  computeFinalGrade,
  FinalGradePerformanceInput,
} from '../../../../src/domain/grade/computeFinalGrade';
import { CategoryWeightInput } from '../../../../src/domain/grade/categoryWeightedMean';
import { SubWeightType } from '../../../../src/domain/grade/SubWeightType';

describe('computeFinalGrade', () => {
  it('returns 0 for empty performances', () => {
    const result = computeFinalGrade([], [{ categoryId: 'cat-1', weight: 100 }]);
    expect(result.rawScore).toBe(0);
    expect(result.categoryGrades).toHaveLength(1);
    expect(result.categoryGrades[0]!.mean).toBe(0);
    expect(result.categoryGrades[0]!.performanceCount).toBe(0);
  });

  it('computes grade for a single category', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions);
    expect(result.rawScore).toBeCloseTo(1.0);
    expect(result.categoryGrades).toHaveLength(1);
    expect(result.categoryGrades[0]!.mean).toBeCloseTo(1.0);
    expect(result.categoryGrades[0]!.performanceCount).toBe(1);
  });

  it('averages performances equally within a category', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
      { categoryId: 'cat-1', normalizedValue: 0.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions);
    expect(result.rawScore).toBeCloseTo(0.5);
    expect(result.categoryGrades[0]!.mean).toBeCloseTo(0.5);
    expect(result.categoryGrades[0]!.performanceCount).toBe(2);
  });

  it('weights categories by their composition weight', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
      { categoryId: 'cat-2', normalizedValue: 0.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 80 },
      { categoryId: 'cat-2', weight: 20 },
    ];
    const result = computeFinalGrade(performances, compositions);
    expect(result.rawScore).toBeCloseTo(0.8);
    expect(result.categoryGrades).toHaveLength(2);
    expect(result.categoryGrades[0]!.mean).toBeCloseTo(1.0);
    expect(result.categoryGrades[0]!.performanceCount).toBe(1);
    expect(result.categoryGrades[1]!.mean).toBeCloseTo(0.0);
    expect(result.categoryGrades[1]!.performanceCount).toBe(1);
  });

  it('handles multiple performances per category', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
      { categoryId: 'cat-1', normalizedValue: 0.6 },
      { categoryId: 'cat-2', normalizedValue: 0.4 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 70 },
      { categoryId: 'cat-2', weight: 30 },
    ];
    const result = computeFinalGrade(performances, compositions);
    const cat1Mean = (1.0 + 0.6) / 2;
    const expected = (cat1Mean * 70 + 0.4 * 30) / 100;
    expect(result.rawScore).toBeCloseTo(expected);
    expect(result.categoryGrades[0]!.mean).toBeCloseTo(cat1Mean);
    expect(result.categoryGrades[0]!.performanceCount).toBe(2);
  });

  it('gracefully handles categories not in compositions', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
      { categoryId: 'cat-unknown', normalizedValue: 0.5 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions);
    expect(result.rawScore).toBeCloseTo(1.0);
    expect(result.categoryGrades).toHaveLength(1);
  });

  it('clamps negative mean to 0', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: -1.0 },
      { categoryId: 'cat-1', normalizedValue: -1.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions);
    expect(result.rawScore).toBe(0);
    expect(result.categoryGrades[0]!.mean).toBe(0);
    expect(result.categoryGrades[0]!.performanceCount).toBe(2);
  });

  it('includes empty categories in categoryGrades with mean 0', () => {
    const performances: FinalGradePerformanceInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 60 },
      { categoryId: 'cat-2', weight: 40 },
    ];
    const result = computeFinalGrade(performances, compositions);
    expect(result.rawScore).toBeCloseTo(1.0);
    expect(result.categoryGrades).toHaveLength(2);
    expect(result.categoryGrades[0]!.performanceCount).toBe(1);
    expect(result.categoryGrades[1]!.performanceCount).toBe(0);
    expect(result.categoryGrades[1]!.mean).toBe(0);
  });

  describe('chronological sub-weighting', () => {
    it('applies chronological weights for 2 performances', () => {
      const performances: FinalGradePerformanceInput[] = [
        { categoryId: 'cat-1', normalizedValue: 0.5, date: new Date('2025-09-01') },
        { categoryId: 'cat-1', normalizedValue: 1.0, date: new Date('2025-11-01') },
      ];
      const compositions: CategoryWeightInput[] = [
        { categoryId: 'cat-1', weight: 100, subWeightType: SubWeightType.CHRONOLOGICAL },
      ];
      const result = computeFinalGrade(performances, compositions);
      // weights: 1/3, 2/3 → mean = 0.5*1/3 + 1.0*2/3 = 0.8333...
      expect(result.rawScore).toBeCloseTo(0.5 * (1/3) + 1.0 * (2/3), 4);
    });

    it('applies chronological weights for 3 performances', () => {
      const performances: FinalGradePerformanceInput[] = [
        { categoryId: 'cat-1', normalizedValue: 0.2, date: new Date('2025-09-01') },
        { categoryId: 'cat-1', normalizedValue: 0.6, date: new Date('2025-10-01') },
        { categoryId: 'cat-1', normalizedValue: 1.0, date: new Date('2025-11-01') },
      ];
      const compositions: CategoryWeightInput[] = [
        { categoryId: 'cat-1', weight: 100, subWeightType: SubWeightType.CHRONOLOGICAL },
      ];
      const result = computeFinalGrade(performances, compositions);
      // weights: 1/6, 2/6, 3/6
      const expected = 0.2 * (1/6) + 0.6 * (2/6) + 1.0 * (3/6);
      expect(result.rawScore).toBeCloseTo(expected, 4);
    });

    it('handles single performance with chronological (same as mean)', () => {
      const performances: FinalGradePerformanceInput[] = [
        { categoryId: 'cat-1', normalizedValue: 0.75, date: new Date('2025-09-01') },
      ];
      const compositions: CategoryWeightInput[] = [
        { categoryId: 'cat-1', weight: 100, subWeightType: SubWeightType.CHRONOLOGICAL },
      ];
      const result = computeFinalGrade(performances, compositions);
      expect(result.rawScore).toBeCloseTo(0.75, 4);
    });

    it('sorts performances by date before applying chronological weights', () => {
      const performances: FinalGradePerformanceInput[] = [
        { categoryId: 'cat-1', normalizedValue: 1.0, date: new Date('2025-11-01') },
        { categoryId: 'cat-1', normalizedValue: 0.0, date: new Date('2025-09-01') },
        { categoryId: 'cat-1', normalizedValue: 0.5, date: new Date('2025-10-01') },
      ];
      const compositions: CategoryWeightInput[] = [
        { categoryId: 'cat-1', weight: 100, subWeightType: SubWeightType.CHRONOLOGICAL },
      ];
      const result = computeFinalGrade(performances, compositions);
      // After sorting: 0.0 (Sep) → 1/6, 0.5 (Oct) → 2/6, 1.0 (Nov) → 3/6
      const expected = 0.0 * (1/6) + 0.5 * (2/6) + 1.0 * (3/6);
      expect(result.rawScore).toBeCloseTo(expected, 4);
    });

    it('handles missing dates by treating them as earliest', () => {
      const performances: FinalGradePerformanceInput[] = [
        { categoryId: 'cat-1', normalizedValue: 1.0, date: new Date('2025-11-01') },
        { categoryId: 'cat-1', normalizedValue: 0.0 },
        { categoryId: 'cat-1', normalizedValue: 0.5, date: new Date('2025-10-01') },
      ];
      const compositions: CategoryWeightInput[] = [
        { categoryId: 'cat-1', weight: 100, subWeightType: SubWeightType.CHRONOLOGICAL },
      ];
      const result = computeFinalGrade(performances, compositions);
      // undefined dates sort to earliest → 0.0 gets weight 1/6, 0.5 gets 2/6, 1.0 gets 3/6
      const expected = 0.0 * (1/6) + 0.5 * (2/6) + 1.0 * (3/6);
      expect(result.rawScore).toBeCloseTo(expected, 4);
    });

    it('mixes chronological and normal categories', () => {
      const performances: FinalGradePerformanceInput[] = [
        { categoryId: 'cat-1', normalizedValue: 0.5, date: new Date('2025-09-01') },
        { categoryId: 'cat-1', normalizedValue: 1.0, date: new Date('2025-11-01') },
        { categoryId: 'cat-2', normalizedValue: 0.8 },
        { categoryId: 'cat-2', normalizedValue: 0.4 },
      ];
      const compositions: CategoryWeightInput[] = [
        { categoryId: 'cat-1', weight: 60, subWeightType: SubWeightType.CHRONOLOGICAL },
        { categoryId: 'cat-2', weight: 40, subWeightType: SubWeightType.NONE },
      ];
      const result = computeFinalGrade(performances, compositions);
      // cat-1 (chronological): 0.5*1/3 + 1.0*2/3 = 0.8333
      // cat-2 (simple): (0.8 + 0.4) / 2 = 0.6
      // final: (0.8333*60 + 0.6*40) / 100 = 0.74
      const cat1Mean = 0.5 * (1/3) + 1.0 * (2/3);
      const cat2Mean = (0.8 + 0.4) / 2;
      const expected = (cat1Mean * 60 + cat2Mean * 40) / 100;
      expect(result.rawScore).toBeCloseTo(expected, 4);
    });
  });
});
