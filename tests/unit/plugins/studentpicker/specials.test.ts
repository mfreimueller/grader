import {
  newSpecial,
  parseSpecials,
  prepareForSave,
  shareForStudents,
  specialsProblem,
} from '../../../../plugins/studentpicker/src/core/specials';
import type { Special } from '../../../../plugins/studentpicker/src/core/types';

const valid = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'sp-1',
  label: 'Nochmal drehen',
  color: '#6d28d9',
  kind: 'spin-again',
  probability: 5,
  showIn: 'always',
  ...overrides,
});

const aSpecial = (overrides: Partial<Special> = {}): Special => ({ ...(valid() as unknown as Special), ...overrides });

describe('parseSpecials', () => {
  it('reads valid specials', () => {
    expect(parseSpecials([valid()])).toEqual([valid()]);
  });

  it.each([undefined, null, 'x', 5, {}, true])('treats %p as nothing stored', (stored) => {
    expect(parseSpecials(stored)).toEqual([]);
  });

  it('defaults showIn to always', () => {
    const stored = valid();
    delete stored['showIn'];

    expect(parseSpecials([stored])[0]?.showIn).toBe('always');
  });

  it('normalizes the color to lower case', () => {
    expect(parseSpecials([valid({ color: '#ED1943' })])[0]?.color).toBe('#ed1943');
  });

  it('keeps a message only for a message special, trimmed', () => {
    const [message, again] = parseSpecials([
      valid({ id: 'm', kind: 'message', message: '  Blatt raus  ' }),
      valid({ id: 'a', kind: 'spin-again', message: 'ignored' }),
    ]);

    expect(message?.message).toBe('Blatt raus');
    expect(again).not.toHaveProperty('message');
  });

  it('drops a blank message', () => {
    expect(parseSpecials([valid({ kind: 'message', message: '   ' })])[0]).not.toHaveProperty('message');
  });

  it.each([
    ['without an id', { id: '' }],
    ['with an id that is not a string', { id: 5 }],
    ['without a label', { label: '   ' }],
    ['with a color that is not a hex color', { color: 'red' }],
    ['with a short hex color', { color: '#fff' }],
    ['of an unknown kind', { kind: 'bonus' }],
    ['with an unknown visibility', { showIn: 'sometimes' }],
    ['with a probability below 0', { probability: -1 }],
    ['with a probability above 100', { probability: 101 }],
    ['with a probability that is not a number', { probability: '5' }],
    ['with a probability that is NaN', { probability: Number.NaN }],
  ])('drops a special %s', (_label, overrides) => {
    expect(parseSpecials([valid(overrides)])).toEqual([]);
  });

  it('drops entries that are not objects and keeps the rest', () => {
    expect(parseSpecials([null, 'x', 4, valid({ id: 'ok' })]).map((s) => s.id)).toEqual(['ok']);
  });

  it('keeps only the first of two specials with the same id', () => {
    const result = parseSpecials([valid({ id: 'x', label: 'first' }), valid({ id: 'x', label: 'second' })]);

    expect(result.map((s) => s.label)).toEqual(['first']);
  });
});

describe('newSpecial', () => {
  it('is a blank spin-again special with a modest chance', () => {
    expect(newSpecial('sp-9')).toEqual({
      id: 'sp-9',
      label: '',
      color: '#6d28d9',
      kind: 'spin-again',
      probability: 5,
      showIn: 'always',
    });
  });
});

describe('specialsProblem', () => {
  it('is null for specials that can be saved', () => {
    expect(specialsProblem([aSpecial(), aSpecial({ id: 'b', probability: 20 })])).toBeNull();
    expect(specialsProblem([])).toBeNull();
  });

  it('asks for a label first', () => {
    expect(specialsProblem([aSpecial({ label: '  ' })])).toBe('label');
  });

  it('refuses a probability outside 0 to 100', () => {
    expect(specialsProblem([aSpecial({ probability: 150 })])).toBe('invalid-probability');
  });

  it('refuses specials that together take every draw', () => {
    expect(specialsProblem([aSpecial({ probability: 60 }), aSpecial({ id: 'b', probability: 40 })])).toBe('sum-too-high');
  });
});

describe('shareForStudents', () => {
  it('is what the specials leave over', () => {
    expect(shareForStudents([aSpecial({ probability: 5 }), aSpecial({ id: 'b', probability: 2.5 })])).toBe(92.5);
    expect(shareForStudents([])).toBe(100);
  });

  it('does not go below zero while a draft is being edited', () => {
    expect(shareForStudents([aSpecial({ probability: 80 }), aSpecial({ id: 'b', probability: 80 })])).toBe(0);
  });

  it('ignores a probability that is not a number yet', () => {
    expect(shareForStudents([aSpecial({ probability: Number.NaN })])).toBe(100);
  });
});

describe('prepareForSave', () => {
  it('trims label and message', () => {
    const [saved] = prepareForSave([aSpecial({ label: '  Pause  ', kind: 'message', message: '  Los  ' })]);

    expect(saved).toMatchObject({ label: 'Pause', message: 'Los' });
  });

  it('leaves out a blank message and any message of a spin-again special', () => {
    const [blank, again] = prepareForSave([
      aSpecial({ kind: 'message', message: '   ' }),
      aSpecial({ id: 'b', kind: 'spin-again', message: 'stale' }),
    ]);

    expect(blank).not.toHaveProperty('message');
    expect(again).not.toHaveProperty('message');
  });

  it('does not change the draft', () => {
    const draft = [aSpecial({ label: ' x ' })];

    prepareForSave(draft);

    expect(draft[0]?.label).toBe(' x ');
  });
});
