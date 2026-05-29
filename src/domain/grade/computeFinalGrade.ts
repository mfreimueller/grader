import { CategoryWeightInput } from './categoryWeightedMean';
import { recencyWeight } from './recencyWeight';

export interface FinalGradePerformanceInput {
  date: Date;
  categoryId: string;
  normalizedValue: number;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / msPerDay);
}

export function computeFinalGrade(
  performances: FinalGradePerformanceInput[],
  compositions: CategoryWeightInput[],
  referenceDate: Date,
): number {
  const weightMap = new Map(compositions.map(c => [c.categoryId, c.weight]));
  const categoryGroups = new Map<string, { values: number[]; weights: number[] }>();

  for (const perf of performances) {
    const days = daysBetween(perf.date, referenceDate);
    const rw = recencyWeight(days);
    const group = categoryGroups.get(perf.categoryId);
    if (group) {
      group.values.push(perf.normalizedValue);
      group.weights.push(rw);
    } else {
      categoryGroups.set(perf.categoryId, { values: [perf.normalizedValue], weights: [rw] });
    }
  }

  let totalWeightedSum = 0;
  let totalWeight = 0;

  for (const [categoryId, group] of categoryGroups) {
    const categoryWeight = weightMap.get(categoryId);
    if (categoryWeight === undefined) continue;

    const weightedSum = group.values.reduce(
      (sum, v, i) => sum + v * group.weights[i]!,
      0,
    );
    console.log(`Calculated weighted sum for category ${categoryId}: ${weightedSum}`);

    const weightSum = group.weights.reduce((a, b) => a + b, 0);
    console.log(`Reduced group weights for category ${categoryId} to ${weightSum}`);

    if (weightSum === 0) continue;

    const recencyWeightedMean = weightedSum / weightSum;
    totalWeightedSum += recencyWeightedMean * categoryWeight;
    totalWeight += categoryWeight;

    console.log(`Calculated new total weight: ${totalWeight}`);
  }

  if (totalWeight === 0) return 0;

  return totalWeightedSum / totalWeight;
}
