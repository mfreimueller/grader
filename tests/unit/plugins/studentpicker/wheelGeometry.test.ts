import type { WheelItem } from '../../../../plugins/studentpicker/src/core/types';
import {
  computeSegments,
  computeSpinRotation,
  isLabelFlipped,
  WHEEL_PALETTE,
  WHEEL_RADIUS,
  wheelFontSize,
} from '../../../../plugins/studentpicker/src/core/wheelGeometry';

const item = (id: string, overrides: Partial<WheelItem> = {}): WheelItem => ({
  id,
  label: id,
  color: null,
  special: false,
  kind: null,
  ...overrides,
});

describe('computeSegments', () => {
  it('uses the own color of an item first and the palette otherwise', () => {
    const segments = computeSegments([item('a', { color: '#112233' }), item('b')]);

    expect(segments.map((s) => s.color)).toEqual(['#112233', WHEEL_PALETTE[1]]);
  });

  it('never puts two palette reds next to each other where the wheel closes', () => {
    const items = Array.from({ length: WHEEL_PALETTE.length + 1 }, (_, i) => item(`s${i}`));

    const segments = computeSegments(items);

    expect(segments.at(-1)!.color).not.toBe(segments[0]!.color);
  });

  it('keeps an own red at the end of the wheel', () => {
    const items = [...Array.from({ length: WHEEL_PALETTE.length }, (_, i) => item(`s${i}`)), item('last', { color: WHEEL_PALETTE[0] })];

    expect(computeSegments(items).at(-1)!.color).toBe(WHEEL_PALETTE[0]);
  });

  it('gives every item an equally sized segment with the label at its centre', () => {
    expect(computeSegments([item('a'), item('b')]).map((s) => s.labelAngle)).toEqual([90, 270]);
    expect(computeSegments([item('a'), item('b'), item('c'), item('d')]).map((s) => s.labelAngle)).toEqual([45, 135, 225, 315]);
  });

  it('draws a single item as a full disc', () => {
    const [only] = computeSegments([item('a')]);

    expect(only!.path).toContain(`A ${WHEEL_RADIUS} ${WHEEL_RADIUS}`);
    expect(only!.path.match(/A /g)).toHaveLength(2);
  });

  it('draws a wedge from the centre for each of several items', () => {
    const [first] = computeSegments([item('a'), item('b'), item('c'), item('d')]);

    expect(first!.path).toBe(`M 0 0 L ${WHEEL_RADIUS}.000 0.000 A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 0.000 ${WHEEL_RADIUS}.000 Z`);
  });

  it('keeps a label whole up to the limit and shortens it with an ellipsis beyond', () => {
    const [short, long] = computeSegments([item('a', { label: 'Anna B.' }), item('b', { label: 'Schriftliche Überprüfung für alle' })]);

    expect(short!.label).toBe('Anna B.');
    expect(long!.label).toHaveLength(16);
    expect(long!.label.endsWith('…')).toBe(true);
  });

  it('marks specials', () => {
    expect(computeSegments([item('a'), item('s', { special: true, kind: 'spin-again' })]).map((s) => s.special)).toEqual([false, true]);
  });

  it('picks the label color that reads best on the segment', () => {
    const [light, dark] = computeSegments([item('a', { color: '#ffaabb' }), item('b', { color: '#004a8d' })]);

    expect([light!.textColor, dark!.textColor]).toEqual(['#111827', '#ffffff']);
  });

  it('is empty without items', () => {
    expect(computeSegments([])).toEqual([]);
  });
});

describe('computeSpinRotation', () => {
  it('ends with the centre of the winner under the pointer at 3 o’clock, after several full turns', () => {
    // Segment 1 of 4 spans 90–180°, its centre is at 135°: the disc turns -135° ≡ 225°, plus 5 turns.
    expect(computeSpinRotation({ count: 4, index: 1, current: 0, jitter: 0 })).toBe(5 * 360 + 225);
  });

  it('turns on from the current rotation instead of rewinding', () => {
    const first = computeSpinRotation({ count: 4, index: 1, current: 0, jitter: 0 });

    const second = computeSpinRotation({ count: 4, index: 3, current: first, jitter: 0 });

    expect(second).toBeGreaterThanOrEqual(first + 5 * 360);
    expect(second % 360).toBe(45); // centre of segment 3 is at 315°
  });

  it('lands off-centre by the jitter, but always inside the segment', () => {
    const left = computeSpinRotation({ count: 4, index: 0, current: 0, jitter: -0.5 });
    const right = computeSpinRotation({ count: 4, index: 0, current: 0, jitter: 0.5 });

    // The centre of segment 0 is at 45°; the pointer may land up to 60 % of half a segment away from it.
    expect([left % 360, right % 360]).toEqual([360 - 45 + 27, 360 - 45 - 27]);
  });

  it('ignores the jitter for a single item', () => {
    expect(computeSpinRotation({ count: 1, index: 0, current: 0, jitter: 0.4 })).toBe(
      computeSpinRotation({ count: 1, index: 0, current: 0, jitter: 0 }),
    );
  });
});

describe('isLabelFlipped', () => {
  it('turns the labels on the left half of the resting wheel around, so every name reads upright', () => {
    expect([0, 45, 89, 271, 315].map((angle) => isLabelFlipped(angle, 0))).toEqual([false, false, false, false, false]);
    expect([91, 135, 180, 225, 269].map((angle) => isLabelFlipped(angle, 0))).toEqual([true, true, true, true, true]);
  });

  it('takes the rotation of the disc into account, however many turns it made', () => {
    expect(isLabelFlipped(45, 180)).toBe(true);
    expect(isLabelFlipped(45, 5 * 360 + 180)).toBe(true);
    expect(isLabelFlipped(180, 5 * 360 + 180)).toBe(false);
    expect(isLabelFlipped(135, -90)).toBe(false);
  });
});

describe('wheel dimensions (Figma "Schülerauswahl": a 340 px disc)', () => {
  it('has a disc radius of 170 px', () => {
    expect(WHEEL_RADIUS).toBe(170);
  });

  it('uses 15 px labels for up to 12 segments and smaller ones on a crowded wheel', () => {
    expect([1, 12].map(wheelFontSize)).toEqual([15, 15]);
    expect([13, 16].map(wheelFontSize)).toEqual([13, 13]);
    expect([17, 24].map(wheelFontSize)).toEqual([11, 11]);
    expect([25, 40].map(wheelFontSize)).toEqual([9, 9]);
  });
});
