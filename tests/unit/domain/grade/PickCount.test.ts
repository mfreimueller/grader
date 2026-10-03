import { PickCount } from '../../../../src/domain/grade/PickCount';

describe('PickCount', () => {
  describe('create', () => {
    it('accepts zero and positive integers', () => {
      const zero = PickCount.create(0);
      const five = PickCount.create(5);

      expect(zero.ok && zero.value.value).toBe(0);
      expect(five.ok && five.value.value).toBe(5);
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %p', (raw) => {
      expect(PickCount.create(raw).ok).toBe(false);
    });
  });
});
