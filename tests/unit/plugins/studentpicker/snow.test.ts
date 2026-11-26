import { snowflakes } from '../../../../plugins/studentpicker/src/core/snow';

const sequence = (...values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('snowflakes', () => {
  it('makes the requested number of flakes with distinct ids', () => {
    const flakes = snowflakes(70, Math.random);

    expect(flakes).toHaveLength(70);
    expect(new Set(flakes.map((f) => f.id)).size).toBe(70);
  });

  it('is empty when no flake is asked for', () => {
    expect(snowflakes(0, Math.random)).toEqual([]);
  });

  it('keeps every flake within its ranges', () => {
    for (const f of snowflakes(300, Math.random)) {
      expect(f.left).toBeGreaterThanOrEqual(0);
      expect(f.left).toBeLessThan(100);
      expect(f.size).toBeGreaterThanOrEqual(2);
      expect(f.size).toBeLessThan(7);
      expect(f.opacity).toBeGreaterThanOrEqual(0.4);
      expect(f.opacity).toBeLessThan(0.9);
      expect(f.durationMs).toBeGreaterThanOrEqual(8000);
      expect(f.durationMs).toBeLessThan(18000);
      // Negative, within one fall: the window is full of snow from the first frame.
      expect(f.delayMs).toBeLessThanOrEqual(0);
      expect(f.delayMs).toBeGreaterThan(-f.durationMs);
      expect(Math.abs(f.sway)).toBeLessThanOrEqual(30);
    }
  });

  it('is decided by the random numbers alone', () => {
    const lowest = snowflakes(1, sequence(0, 0, 0, 0, 0, 0));
    const highest = snowflakes(1, sequence(0.999, 0.999, 0.999, 0.999, 0.999, 0.999));

    expect(lowest[0]).toMatchObject({ left: 0, size: 2, opacity: 0.4, durationMs: 8000, delayMs: -0, sway: -30 });
    expect(highest[0]!.left).toBeCloseTo(99.9);
    expect(highest[0]!.sway).toBeCloseTo(29.94);
  });
});
