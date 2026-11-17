import { landingAngle, roulettePockets, ZERO_POCKET_ID } from '../../../../plugins/studentpicker/src/core/rouletteGeometry';
import type { WheelItem } from '../../../../plugins/studentpicker/src/core/types';

const student = (id: string): WheelItem => ({ id, label: id, color: null, special: false, kind: null });
const special = (id: string): WheelItem => ({ id, label: id, color: '#6d28d9', special: true, kind: 'spin-again' });

describe('roulettePockets', () => {
  it('starts with a green zero that is never a target, then one pocket per item in order', () => {
    const pockets = roulettePockets([student('a'), student('b')]);
    expect(pockets.map((p) => p.id)).toEqual([ZERO_POCKET_ID, 'a', 'b']);
    expect(pockets[0]).toEqual({ id: ZERO_POCKET_ID, label: '0', number: 0, color: 'green', target: false });
  });

  it('alternates red and black over the students and numbers them from 1', () => {
    const pockets = roulettePockets([student('a'), student('b'), student('c')]);
    expect(pockets.slice(1).map((p) => [p.number, p.color, p.target])).toEqual([
      [1, 'red', true],
      [2, 'black', true],
      [3, 'red', true],
    ]);
  });

  it('makes specials green, unnumbered targets that do not break the alternation', () => {
    const pockets = roulettePockets([student('a'), special('x'), student('b')]);
    expect(pockets.slice(1).map((p) => [p.label, p.number, p.color, p.target])).toEqual([
      ['a', 1, 'red', true],
      ['x', null, 'green', true],
      ['b', 2, 'black', true],
    ]);
  });
});

describe('landingAngle', () => {
  it('is the centre of the pocket in radians, clockwise from 12 o’clock', () => {
    expect(landingAngle(0, 4, 0)).toBeCloseTo(Math.PI / 4);
    expect(landingAngle(2, 4, 0)).toBeCloseTo((5 * Math.PI) / 4);
  });

  it('moves at most 15 % of a pocket away from the centre', () => {
    const width = (2 * Math.PI) / 4;
    expect(landingAngle(0, 4, 0.5)).toBeCloseTo(width * 0.5 + width * 0.15);
    expect(landingAngle(0, 4, -0.5)).toBeCloseTo(width * 0.5 - width * 0.15);
  });
});
