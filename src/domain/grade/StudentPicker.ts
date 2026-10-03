import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

/**
 * Picks students for oral participation. A student's count is how often they were already picked;
 * students without a stored count have been picked zero times.
 */
export const StudentPicker = {
  /** The students who may be drawn in fair mode: everybody at the minimum count, in roster order. */
  fairPool(studentIds: readonly string[], counts: ReadonlyMap<string, number>): string[] {
    if (studentIds.length === 0) return [];
    const countOf = (id: string): number => counts.get(id) ?? 0;
    const min = Math.min(...studentIds.map(countOf));
    return studentIds.filter((id) => countOf(id) === min);
  },

  /** `random` must return a number in [0, 1), like Math.random. */
  pickRandom(
    studentIds: readonly string[],
    counts: ReadonlyMap<string, number>,
    fair: boolean,
    random: () => number,
  ): Result<string> {
    const pool = fair ? StudentPicker.fairPool(studentIds, counts) : [...studentIds];
    const winner = pool[Math.floor(random() * pool.length)];
    if (winner === undefined) {
      return Result.fail(new ValidationError('Es gibt keine Schüler, die ausgewählt werden können.'));
    }
    return Result.ok(winner);
  },
} as const;
