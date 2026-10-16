import { CONFETTI_COLORS, confettiPieces } from '../../../../plugins/studentpicker/src/core/confetti';

/** A repeatable stand-in for Math.random that walks through the given values. */
const sequence = (...values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('confettiPieces', () => {
  it('makes the requested number of pieces with distinct ids', () => {
    const pieces = confettiPieces(40, Math.random);

    expect(pieces).toHaveLength(40);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(40);
  });

  it('only uses the colors of the Figma confetti: the wheel palette, yellow and white', () => {
    expect(CONFETTI_COLORS).toEqual(['#ed1943', '#004a8d', '#d97706', '#059669', '#6d28d9', '#0891b2', '#facc15', '#ffffff']);
    const colors = new Set(confettiPieces(200, Math.random).map((p) => p.color));

    expect([...colors].every((c) => CONFETTI_COLORS.includes(c))).toBe(true);
  });

  it('keeps every piece within the window and the timing', () => {
    for (const p of confettiPieces(200, Math.random)) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left).toBeLessThan(100);
      expect(p.delayMs).toBeGreaterThanOrEqual(0);
      expect(p.delayMs).toBeLessThan(900);
      expect(p.durationMs).toBeGreaterThanOrEqual(2600);
      expect(p.durationMs).toBeLessThan(4200);
      expect(p.opacity).toBeGreaterThanOrEqual(0.85);
      expect(p.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('draws strips, chips and dots in the sizes of the design', () => {
    const [strip] = confettiPieces(1, sequence(0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    const [chip] = confettiPieces(1, sequence(0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    const [dot] = confettiPieces(1, sequence(0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0));

    expect(strip).toMatchObject({ shape: 'strip', width: 3, height: 14 });
    expect(chip).toMatchObject({ shape: 'chip', width: 13, height: 6 });
    expect(dot).toMatchObject({ shape: 'dot', width: 7, height: 7 });
  });

  it('is empty when no piece is asked for', () => {
    expect(confettiPieces(0, Math.random)).toEqual([]);
  });
});
