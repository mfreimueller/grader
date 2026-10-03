import { StudentPicker } from '../../../../src/domain/grade/StudentPicker';

const ids = (...values: string[]): string[] => values;

describe('StudentPicker', () => {
  describe('pickRandom', () => {
    it('fails when there is nobody to pick', () => {
      const result = StudentPicker.pickRandom([], new Map(), true, () => 0);

      expect(result.ok).toBe(false);
    });

    it('in fair mode only draws from students with the minimum count', () => {
      const counts = new Map([['a', 2], ['b', 1], ['c', 1]]);

      const first = StudentPicker.pickRandom(ids('a', 'b', 'c'), counts, true, () => 0);
      const last = StudentPicker.pickRandom(ids('a', 'b', 'c'), counts, true, () => 0.999);

      expect(first.ok && first.value).toBe('b');
      expect(last.ok && last.value).toBe('c');
    });

    it('treats students without a stored count as having been picked zero times', () => {
      const counts = new Map([['a', 1]]);

      const result = StudentPicker.pickRandom(ids('a', 'b'), counts, true, () => 0.5);

      expect(result.ok && result.value).toBe('b');
    });

    it('in fair mode includes everybody once all counts are equal', () => {
      const counts = new Map([['a', 1], ['b', 1]]);

      const first = StudentPicker.pickRandom(ids('a', 'b'), counts, true, () => 0);
      const last = StudentPicker.pickRandom(ids('a', 'b'), counts, true, () => 0.999);

      expect(first.ok && first.value).toBe('a');
      expect(last.ok && last.value).toBe('b');
    });

    it('with fair mode off draws from everybody regardless of counts', () => {
      const counts = new Map([['a', 5], ['b', 0]]);

      const result = StudentPicker.pickRandom(ids('a', 'b'), counts, false, () => 0);

      expect(result.ok && result.value).toBe('a');
    });

    it('can pick the only student', () => {
      const result = StudentPicker.pickRandom(ids('a'), new Map([['a', 3]]), true, () => 0.9);

      expect(result.ok && result.value).toBe('a');
    });
  });

  describe('fairPool', () => {
    it('returns the students at the minimum count in roster order', () => {
      const counts = new Map([['a', 2], ['b', 1], ['c', 1]]);

      expect(StudentPicker.fairPool(ids('a', 'b', 'c'), counts)).toEqual(['b', 'c']);
    });

    it('returns an empty pool for an empty roster', () => {
      expect(StudentPicker.fairPool([], new Map())).toEqual([]);
    });
  });
});
