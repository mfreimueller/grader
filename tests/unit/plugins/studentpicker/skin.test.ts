import { DEFAULT_SKIN, parseSkin, SKINS } from '../../../../plugins/studentpicker/src/core/skin';

describe('parseSkin', () => {
  it('reads every known skin', () => {
    expect(SKINS.map((skin) => parseSkin(skin))).toEqual(['slotmachine', 'wheel', 'casino', 'advent']);
  });

  it('falls back to the slot machine when nothing or something unknown is stored', () => {
    expect(DEFAULT_SKIN).toBe('slotmachine');
    expect([null, undefined, '', 'roulette', 1, { skin: 'wheel' }].map(parseSkin)).toEqual(Array(6).fill('slotmachine'));
  });
});
