import { recencyWeight } from '../../../../src/domain/grade/recencyWeight';

describe('recencyWeight', () => {
  it('returns 1 for 0 days (same day)', () => {
    expect(recencyWeight(0)).toBeCloseTo(1.0);
  });

  it('returns 0.5 for 1 day', () => {
    expect(recencyWeight(1)).toBeCloseTo(0.5);
  });

  it('returns 0.125 for 7 days', () => {
    expect(recencyWeight(7)).toBeCloseTo(0.125);
  });

  it('returns 0.032... for 30 days', () => {
    expect(recencyWeight(30)).toBeCloseTo(1 / 31);
  });

  it('returns smaller weight for older performances', () => {
    expect(recencyWeight(10)).toBeLessThan(recencyWeight(5));
  });
});
