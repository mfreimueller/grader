import {
  computeFinalGrade,
  FinalGradePerformanceInput,
} from '../../../../src/domain/grade/computeFinalGrade';
import { CategoryWeightInput } from '../../../../src/domain/grade/categoryWeightedMean';

describe('computeFinalGrade', () => {
  const today = new Date(2025, 9, 15);

  it('returns 0 for empty performances', () => {
    const result = computeFinalGrade([], [{ categoryId: 'cat-1', weight: 100 }], today);
    expect(result).toBe(0);
  });

  it('computes grade for a single category with recency', () => {
    const performances: FinalGradePerformanceInput[] = [
      { date: today, categoryId: 'cat-1', normalizedValue: 1.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions, today);
    expect(result).toBeCloseTo(1.0);
  });

  it('averages performances equally within a category (no recency bias)', () => {
    const performances: FinalGradePerformanceInput[] = [
      { date: new Date(2025, 9, 1), categoryId: 'cat-1', normalizedValue: 1.0 },
      { date: today, categoryId: 'cat-1', normalizedValue: 0.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions, today);
    expect(result).toBeCloseTo(0.5);
  });

  it('weights categories by their composition weight', () => {
    const performances: FinalGradePerformanceInput[] = [
      { date: today, categoryId: 'cat-1', normalizedValue: 1.0 },
      { date: today, categoryId: 'cat-2', normalizedValue: 0.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 80 },
      { categoryId: 'cat-2', weight: 20 },
    ];
    const result = computeFinalGrade(performances, compositions, today);
    expect(result).toBeCloseTo(0.8);
  });

  it('handles multiple performances per category with recency', () => {
    const performances: FinalGradePerformanceInput[] = [
      { date: today, categoryId: 'cat-1', normalizedValue: 1.0 },
      { date: today, categoryId: 'cat-1', normalizedValue: 0.6 },
      { date: today, categoryId: 'cat-2', normalizedValue: 0.4 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 70 },
      { categoryId: 'cat-2', weight: 30 },
    ];
    const result = computeFinalGrade(performances, compositions, today);
    const cat1Mean = (1.0 + 0.6) / 2;
    const expected = (cat1Mean * 70 + 0.4 * 30) / 100;
    expect(result).toBeCloseTo(expected);
  });

  it('gracefully handles categories not in compositions', () => {
    const performances: FinalGradePerformanceInput[] = [
      { date: today, categoryId: 'cat-1', normalizedValue: 1.0 },
      { date: today, categoryId: 'cat-unknown', normalizedValue: 0.5 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = computeFinalGrade(performances, compositions, today);
    expect(result).toBeCloseTo(1.0);
  });
});
