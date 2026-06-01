import { SubWeightType } from './SubWeightType';

export interface CategoryMeanInput {
  categoryId: string;
  normalizedValue: number;
  date?: Date;
}

export interface CategoryWeightInput {
  categoryId: string;
  weight: number;
  subWeightType?: SubWeightType;
}

export function categoryWeightedMean(
  performances: CategoryMeanInput[],
  compositions: CategoryWeightInput[],
): number {
  const weightMap = new Map(compositions.map(c => [c.categoryId, c.weight]));
  const categoryGroups = new Map<string, number[]>();

  for (const perf of performances) {
    const group = categoryGroups.get(perf.categoryId);
    if (group) {
      group.push(perf.normalizedValue);
    } else {
      categoryGroups.set(perf.categoryId, [perf.normalizedValue]);
    }
  }

  let totalWeightedSum = 0;
  let totalWeight = 0;

  for (const [categoryId, values] of categoryGroups) {
    const categoryWeight = weightMap.get(categoryId);
    if (categoryWeight === undefined) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    totalWeightedSum += mean * categoryWeight;
    totalWeight += categoryWeight;
  }

  if (totalWeight === 0) return 0;

  return totalWeightedSum / totalWeight;
}
