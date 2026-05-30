import { CategoryWeightInput } from './categoryWeightedMean';

export interface FinalGradePerformanceInput {
  categoryId: string;
  normalizedValue: number;
}

export interface CategoryGradeResult {
  categoryId: string;
  mean: number;
  performanceCount: number;
}

export interface ComputeFinalGradeResult {
  rawScore: number;
  categoryGrades: CategoryGradeResult[];
}

export function computeFinalGrade(
  performances: FinalGradePerformanceInput[],
  compositions: CategoryWeightInput[],
): ComputeFinalGradeResult {
  const categoryGroups = new Map<string, number[]>();

  for (const perf of performances) {
    const group = categoryGroups.get(perf.categoryId);
    if (group) {
      group.push(perf.normalizedValue);
    } else {
      categoryGroups.set(perf.categoryId, [perf.normalizedValue]);
    }
  }

  console.log(
    '[GRADE]',
    `computeFinalGrade: ${performances.length} performances, ${compositions.length} compositions`,
  );

  let totalWeightedSum = 0;
  let totalWeight = 0;
  const categoryGrades: CategoryGradeResult[] = [];

  for (const comp of compositions) {
    const values = categoryGroups.get(comp.categoryId) ?? [];
    const count = values.length;

    let mean: number;
    if (count === 0) {
      mean = 0;
    } else {
      const sum = values.reduce((a, b) => a + b, 0);
      mean = Math.max(0, sum / count);
      console.log(
        '[GRADE]',
        `Category ${comp.categoryId}: sum=${sum.toFixed(4)}, count=${count}, mean=${mean.toFixed(4)}, contribution=${(mean * comp.weight).toFixed(4)}`,
      );
      totalWeightedSum += mean * comp.weight;
      totalWeight += comp.weight;
    }

    categoryGrades.push({ categoryId: comp.categoryId, mean, performanceCount: count });
  }

  return {
    rawScore: totalWeight === 0 ? 0 : totalWeightedSum / totalWeight,
    categoryGrades,
  };
}
