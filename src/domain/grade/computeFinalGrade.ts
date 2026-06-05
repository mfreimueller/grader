import { CategoryWeightInput } from './categoryWeightedMean';
import { SubWeightType } from './SubWeightType';

export interface FinalGradePerformanceInput {
  categoryId: string;
  normalizedValue: number;
  date?: Date;
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

function chronologicalWeightedMean(
  values: { normalizedValue: number; date?: Date }[],
): number {
  const sorted = [...values].sort(
    (a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0),
  );
  const n = sorted.length;
  if (n === 0) return 0;
  const totalWeight = (n * (n + 1)) / 2;
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    const position = i + 1;
    weightedSum += sorted[i]!.normalizedValue * (position / totalWeight);
  }
  return weightedSum;
}

export function computeFinalGrade(
  performances: FinalGradePerformanceInput[],
  compositions: CategoryWeightInput[],
): ComputeFinalGradeResult {
  const categoryGroups = new Map<string, FinalGradePerformanceInput[]>();

  for (const perf of performances) {
    const group = categoryGroups.get(perf.categoryId);
    if (group) {
      group.push(perf);
    } else {
      categoryGroups.set(perf.categoryId, [perf]);
    }
  }

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
      if (comp.subWeightType === SubWeightType.CHRONOLOGICAL) {
        mean = Math.max(0, chronologicalWeightedMean(values));
      } else {
        const sum = values.reduce((a, b) => a + b.normalizedValue, 0);
        mean = Math.max(0, sum / count);
      }
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
