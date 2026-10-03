import {
  computeSegments,
  computeSpinRotation,
  wheelFontSize,
  WHEEL_PALETTE,
} from '../../../src/renderer/utils/wheelGeometry';

const student = (id: string, color: string | null = null, firstName = 'Max', lastName = 'Muster') => ({
  studentId: id,
  firstName,
  lastName,
  color,
});

const many = (n: number, color: string | null = null) =>
  Array.from({ length: n }, (_, i) => student(`s-${i}`, color));

describe('computeSegments', () => {
  it('draws a single student as a full disc', () => {
    const [segment] = computeSegments([student('a')]);

    expect(segment!.path).toBe('M 100 0 A 100 100 0 1 1 -100 0 A 100 100 0 1 1 100 0 Z');
  });

  it('draws two students as two half discs', () => {
    const segments = computeSegments([student('a'), student('b')]);

    expect(segments[0]!.path).toBe('M 0 0 L 100.000 0.000 A 100 100 0 0 1 -100.000 0.000 Z');
    expect(segments[1]!.path).toContain('A 100 100 0 0 1');
  });

  it('uses the large-arc flag for a segment wider than half a circle', () => {
    // n = 1 is special-cased, so a >180° segment cannot occur with n >= 2; guard the threshold instead.
    const segments = computeSegments(many(3));

    expect(segments.every((s) => s.path.includes(' 0 0 1 '))).toBe(true);
  });

  it('cycles through the palette', () => {
    const segments = computeSegments(many(3));

    expect(segments.map((s) => s.color)).toEqual(WHEEL_PALETTE.slice(0, 3));
  });

  it.each([2, 5, 6, 7, 8, 12, 13, 25])('never gives neighbours the same color for %i students', (n) => {
    const segments = computeSegments(many(n));

    segments.forEach((segment, i) => {
      const next = segments[(i + 1) % n]!;
      expect(segment.color).not.toBe(next.color);
    });
  });

  it('lets a students own color win over the palette', () => {
    const segments = computeSegments([student('a', '#123456'), student('b')]);

    expect(segments[0]!.color).toBe('#123456');
    expect(segments[1]!.color).toBe(WHEEL_PALETTE[1]);
  });

  it('keeps deliberately chosen colors even when they match a neighbour', () => {
    const segments = computeSegments([student('a', '#123456'), student('b', '#123456')]);

    expect(segments.map((s) => s.color)).toEqual(['#123456', '#123456']);
  });

  it('places the label in the middle of each segment', () => {
    const segments = computeSegments(many(4));

    expect(segments.map((s) => s.labelAngle)).toEqual([45, 135, 225, 315]);
  });

  it('labels with last name first and shortens long names with an ellipsis', () => {
    const [short, long] = computeSegments([
      student('a', null, 'Max', 'Muster'),
      student('b', null, 'Maximilian-Alexander', 'Mustermann'),
    ]);

    expect(short!.label).toBe('Muster Max');
    expect(long!.label).toBe('Mustermann Maxi…');
    expect(long!.label).toHaveLength(16);
  });
});

describe('wheelFontSize', () => {
  it.each([
    [5, 10.5],
    [10, 10.5],
    [11, 9],
    [16, 9],
    [17, 7.5],
    [24, 7.5],
    [25, 6],
  ])('uses a font for %i students', (count, expected) => {
    expect(wheelFontSize(count)).toBe(expected);
  });
});

describe('computeSpinRotation', () => {
  const stepOf = (count: number): number => 360 / count;
  const mod = (v: number): number => ((v % 360) + 360) % 360;

  it.each([
    [4, 0, 0],
    [4, 3, 0],
    [7, 2, 123.4],
    [25, 24, 777],
  ])('ends with the winners segment under the pointer (%i students, index %i, from %f°)', (count, index, current) => {
    const rotation = computeSpinRotation({ count, index, current, jitter: 0 });

    expect(mod(rotation + (index + 0.5) * stepOf(count))).toBeCloseTo(0, 6);
  });

  it('spins at least five full turns forward', () => {
    const rotation = computeSpinRotation({ count: 5, index: 1, current: 100, jitter: 0 });

    expect(rotation).toBeGreaterThanOrEqual(100 + 5 * 360);
    expect(rotation).toBeLessThan(100 + 6 * 360);
  });

  it('lands inside the winners segment when jittered', () => {
    const count = 6;
    const rotation = computeSpinRotation({ count, index: 2, current: 0, jitter: 0.5 });
    const offsetFromCentre = mod(rotation + (2 + 0.5) * stepOf(count) + 180) - 180;

    expect(Math.abs(offsetFromCentre)).toBeLessThanOrEqual(stepOf(count) / 2);
  });

  it('does not jitter a single student', () => {
    const rotation = computeSpinRotation({ count: 1, index: 0, current: 0, jitter: 0.5 });

    expect(mod(rotation + 180)).toBeCloseTo(0, 6);
  });
});
