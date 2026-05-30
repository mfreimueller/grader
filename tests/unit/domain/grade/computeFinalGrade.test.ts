import {
  computeFinalGrade,
  FinalGradePerformanceInput,
} from '../../../../src/domain/grade/computeFinalGrade';
import { CategoryWeightInput } from '../../../../src/domain/grade/categoryWeightedMean';

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
});
