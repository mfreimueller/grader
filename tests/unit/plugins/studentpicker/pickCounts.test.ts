import {
  applyCounts,
  incrementCount,
  parsePickCounts,
  parseCountInput,
  setCount,
} from '../../../../plugins/studentpicker/src/core/pickCounts';

describe('parsePickCounts', () => {
  it('reads what was stored', () => {
    expect(parsePickCounts({ a: 2, b: 0 })).toEqual({ a: 2, b: 0 });
  });

  it.each([undefined, null, 'x', 5, true, [], [1, 2]])('treats %p as nothing stored', (stored) => {
    expect(parsePickCounts(stored)).toEqual({});
  });

  it('keeps only whole numbers from 0, whatever else got into the data', () => {
    const stored = { good: 3, text: 'x', negative: -1, fraction: 1.5, nan: Number.NaN, nothing: null, nested: { a: 1 } };

    expect(parsePickCounts(stored)).toEqual({ good: 3 });
  });

  it('keeps a key called __proto__ as plain data instead of changing the object', () => {
    const stored = JSON.parse('{"__proto__": 4, "a": 1}') as unknown;

    const counts = parsePickCounts(stored);

    expect(Object.keys(counts).sort()).toEqual(['__proto__', 'a']);
    expect(Object.getPrototypeOf(counts)).toBe(Object.prototype);
  });
});

describe('incrementCount', () => {
  it('starts at 1 for a student without a count', () => {
    expect(incrementCount({}, 'a')).toEqual({ a: 1 });
  });

  it('adds one to an existing count and leaves the others alone', () => {
    expect(incrementCount({ a: 2, b: 5 }, 'a')).toEqual({ a: 3, b: 5 });
  });

  it('does not change the object it was given', () => {
    const before = { a: 1 };

    incrementCount(before, 'a');

    expect(before).toEqual({ a: 1 });
  });
});

describe('parseCountInput', () => {
  it.each([
    ['0', 0],
    ['7', 7],
    [' 12 ', 12],
    [3, 3],
  ])('accepts %p', (input, expected) => {
    expect(parseCountInput(input)).toBe(expected);
  });

  it.each(['', ' ', '-1', '1.5', 'abc', '1e3', Number.NaN, -2, 2.5, null, undefined])('rejects %p', (input) => {
    expect(parseCountInput(input)).toBeNull();
  });
});

describe('setCount', () => {
  it('sets the count of one student', () => {
    expect(setCount({ a: 1, b: 2 }, 'a', 9)).toEqual({ a: 9, b: 2 });
  });

  it('does not change the object it was given', () => {
    const before = { a: 1 };

    setCount(before, 'a', 5);

    expect(before).toEqual({ a: 1 });
  });
});

describe('applyCounts', () => {
  const student = (id: string, last: string, color: string | null = null) => ({ id, firstName: 'X', lastName: last, color });

  it('gives every student their count, 0 when there is none', () => {
    const students = [student('a', 'Bauer', '#ed1943'), student('b', 'Muster')];

    expect(applyCounts(students, { a: 4 })).toEqual([
      { id: 'a', firstName: 'X', lastName: 'Bauer', color: '#ed1943', pickCount: 4 },
      { id: 'b', firstName: 'X', lastName: 'Muster', color: null, pickCount: 0 },
    ]);
  });

  it('ignores counts of students who are not here', () => {
    expect(applyCounts([student('a', 'Bauer')], { a: 1, gone: 7 })).toHaveLength(1);
  });
});
