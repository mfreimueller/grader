import { CategoryWeightInput } from './categoryWeightedMean';

export interface FinalGradePerformanceInput {
  date: Date;
  categoryId: string;
  normalizedValue: number;
}

export function computeFinalGrade(
  performances: FinalGradePerformanceInput[],
  compositions: CategoryWeightInput[],
  _referenceDate: Date,
): number {
  const weightMap = new Map(compositions.map(c => [c.categoryId, c.weight]));
  const categoryGroups = new Map<string, { values: number[]; weights: number[] }>();

  for (const perf of performances) {
    const group = categoryGroups.get(perf.categoryId);
    if (group) {
      group.values.push(perf.normalizedValue);
      group.weights.push(1);
    } else {
      categoryGroups.set(perf.categoryId, { values: [perf.normalizedValue], weights: [1] });
    }
  }

  console.log(
    '[GRADE]',
    `computeFinalGrade: ${performances.length} performances, ${compositions.length} compositions`,
  );

  let totalWeightedSum = 0;
  let totalWeight = 0;

  for (const [categoryId, group] of categoryGroups) {
    const categoryWeight = weightMap.get(categoryId);
    if (categoryWeight === undefined) {
      console.log('[GRADE]', `Category ${categoryId}: skipped (no weight configured)`);
      continue;
    }

    const perfDates = performances
      .filter(p => p.categoryId === categoryId)
      .map(p => p.date.toISOString().slice(0, 10));
    console.log(
      '[GRADE]',
      `Category ${categoryId}: ${group.values.length} performances, dates=${perfDates.join(', ')}, categoryWeight=${categoryWeight}`,
    );

    const sum = group.values.reduce((a, b) => a + b, 0);
    const count = group.values.length;
    console.log(`[GRADE] Category ${categoryId}: sum=${sum.toFixed(4)}, count=${count}`);

    if (count === 0) {
      console.log('[GRADE]', `Category ${categoryId}: skipped (no performances)`);
      continue;
    }

    const mean = sum / count;
    console.log(
      '[GRADE]',
      `Category ${categoryId}: mean=${mean.toFixed(4)}, contribution=${(mean * categoryWeight).toFixed(4)}`,
    );
    totalWeightedSum += mean * categoryWeight;
    totalWeight += categoryWeight;
  }

  if (totalWeight === 0) return 0;

  return totalWeightedSum / totalWeight;
}
