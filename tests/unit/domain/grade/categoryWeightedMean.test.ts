import {
  categoryWeightedMean,
  CategoryMeanInput,
  CategoryWeightInput,
} from '../../../../src/domain/grade/categoryWeightedMean';

describe('categoryWeightedMean', () => {
  it('returns 0 for empty performances', () => {
    const result = categoryWeightedMean([], [{ categoryId: 'cat-1', weight: 100 }]);
    expect(result).toBe(0);
  });

  it('returns the plain mean when all weights are equal', () => {
    const performances: CategoryMeanInput[] = [
      { categoryId: 'cat-1', normalizedValue: 0.8 },
      { categoryId: 'cat-1', normalizedValue: 1.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = categoryWeightedMean(performances, compositions);
    expect(result).toBeCloseTo(0.9);
  });

  it('weights categories by their composition weight', () => {
    const performances: CategoryMeanInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
      { categoryId: 'cat-2', normalizedValue: 0.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 80 },
      { categoryId: 'cat-2', weight: 20 },
    ];
    const result = categoryWeightedMean(performances, compositions);
    expect(result).toBeCloseTo(0.8);
  });

  it('ignores categories not in compositions', () => {
    const performances: CategoryMeanInput[] = [
      { categoryId: 'cat-1', normalizedValue: 1.0 },
      { categoryId: 'cat-unknown', normalizedValue: 0.0 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 100 },
    ];
    const result = categoryWeightedMean(performances, compositions);
    expect(result).toBeCloseTo(1.0);
  });

  it('handles multiple performances per category', () => {
    const performances: CategoryMeanInput[] = [
      { categoryId: 'cat-1', normalizedValue: 0.8 },
      { categoryId: 'cat-1', normalizedValue: 0.6 },
      { categoryId: 'cat-2', normalizedValue: 0.4 },
      { categoryId: 'cat-2', normalizedValue: 0.2 },
    ];
    const compositions: CategoryWeightInput[] = [
      { categoryId: 'cat-1', weight: 70 },
      { categoryId: 'cat-2', weight: 30 },
    ];
    const result = categoryWeightedMean(performances, compositions);
    const cat1Mean = (0.8 + 0.6) / 2;
    const cat2Mean = (0.4 + 0.2) / 2;
    const expected = (cat1Mean * 70 + cat2Mean * 30) / 100;
    expect(result).toBeCloseTo(expected);
  });
});
