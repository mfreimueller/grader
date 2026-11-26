import {
  ADVENT_KEY,
  DOOR_COUNT,
  adventSpecials,
  createCalendar,
  doorContent,
  openDoor,
  parseCalendar,
  type AdventCalendar,
  type DoorContent,
} from '../../../../plugins/studentpicker/src/core/advent';
import type { Special, Student } from '../../../../plugins/studentpicker/src/core/types';

const sequence = (...values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

const inOrder = Array.from({ length: DOOR_COUNT }, (_, i) => i + 1);
const anna: DoorContent = { kind: 'student', studentId: 's-1', name: 'Anna Bauer' };
const prize: DoorContent = { kind: 'special', specialId: 'p-1', label: 'Hausübung erlassen', color: '#059669' };
const aCalendar = (overrides: Partial<AdventCalendar> = {}): AdventCalendar => ({ order: inOrder, doors: {}, ...overrides });
const special = (overrides: Partial<Special>): Special => ({
  id: 'x',
  label: 'X',
  color: '#ffffff',
  kind: 'message',
  probability: 5,
  showIn: 'always',
  ...overrides,
});

describe('createCalendar', () => {
  it('uses its own storage key', () => {
    expect(ADVENT_KEY).toBe('adventCalendar');
  });

  it('shuffles the 24 doors into a permutation with all doors closed', () => {
    const calendar = createCalendar(Math.random);

    expect([...calendar.order].sort((a, b) => a - b)).toEqual(inOrder);
    expect(calendar.doors).toEqual({});
  });

  it('keeps the order when the random numbers always pick the last position', () => {
    expect(createCalendar(() => 0.999).order).toEqual(inOrder);
  });

  it('moves the first door to the end when the random numbers always pick the first position', () => {
    expect(createCalendar(() => 0).order).toEqual([...inOrder.slice(1), 1]);
  });
});

describe('parseCalendar', () => {
  it('takes a stored calendar as it is', () => {
    const stored = { order: [...inOrder].reverse(), doors: { '3': anna, '7': prize } };

    expect(parseCalendar(stored, Math.random)).toEqual({ order: [...inOrder].reverse(), doors: { 3: anna, 7: prize } });
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'x'],
    ['an array', []],
    ['no order', { doors: {} }],
    ['an order that is no array', { order: 'abc', doors: {} }],
    ['an order that is too short', { order: inOrder.slice(1), doors: {} }],
    ['an order with a duplicate', { order: [...inOrder.slice(0, 23), 1], doors: {} }],
    ['an order with a door out of range', { order: [...inOrder.slice(1), 25], doors: {} }],
    ['an order with a fraction', { order: [...inOrder.slice(1), 1.5], doors: {} }],
    ['an order with a non-number', { order: [...inOrder.slice(1), '1'], doors: {} }],
  ])('starts over with %s', (_name, stored) => {
    const calendar = parseCalendar(stored, () => 0.999);

    expect(calendar).toEqual({ order: inOrder, doors: {} });
  });

  it('has no open doors when the doors are missing or no object', () => {
    expect(parseCalendar({ order: inOrder }, Math.random).doors).toEqual({});
    expect(parseCalendar({ order: inOrder, doors: 'x' }, Math.random).doors).toEqual({});
    expect(parseCalendar({ order: inOrder, doors: null }, Math.random).doors).toEqual({});
    expect(parseCalendar({ order: inOrder, doors: [anna] }, Math.random).doors).toEqual({});
  });

  it('drops the doors that are no good and keeps the others', () => {
    const doors = {
      '1': anna,
      '0': anna,
      '25': anna,
      '2.5': anna,
      abc: anna,
      '2': null,
      '3': 'Anna',
      '4': { kind: 'student', studentId: 's', name: '' },
      '5': { kind: 'student', studentId: 5, name: 'Anna' },
      '6': { kind: 'student', studentId: '', name: 'Anna' },
      '7': { kind: 'special', specialId: 'p', label: 'L', color: 'red' },
      '8': { kind: 'special', specialId: 'p', label: '', color: '#059669' },
      '9': { kind: 'special', specialId: '', label: 'L', color: '#059669' },
      '10': { kind: 'special', specialId: 'p', label: 'L', color: 7 },
      '11': { kind: 'other' },
      '12': prize,
    };

    expect(parseCalendar({ order: inOrder, doors }, Math.random).doors).toEqual({ 1: anna, 12: prize });
  });

  it('keeps only the known fields of a door', () => {
    const doors = { '1': { ...anna, extra: 'x' } };

    expect(parseCalendar({ order: inOrder, doors }, Math.random).doors).toEqual({ 1: anna });
  });
});

describe('openDoor', () => {
  it('opens a closed door with its content and leaves the old calendar alone', () => {
    const before = aCalendar();

    const result = openDoor(before, 5, anna);

    expect(result).toEqual({ ok: true, calendar: { order: inOrder, doors: { 5: anna } } });
    expect(before.doors).toEqual({});
  });

  it('keeps the doors that are already open', () => {
    const result = openDoor(aCalendar({ doors: { 5: anna } }), 6, prize);

    expect(result).toEqual({ ok: true, calendar: { order: inOrder, doors: { 5: anna, 6: prize } } });
  });

  it('refuses a door that is open already', () => {
    expect(openDoor(aCalendar({ doors: { 5: anna } }), 5, prize)).toEqual({ ok: false, error: 'already-open' });
  });

  it.each([0, 25, -1, 1.5, Number.NaN])('refuses door %s', (door) => {
    expect(openDoor(aCalendar(), door, anna)).toEqual({ ok: false, error: 'no-such-door' });
  });
});

describe('adventSpecials', () => {
  it('leaves out the specials that spin again, so a door always gives exactly one result', () => {
    const again = special({ id: 'a', kind: 'spin-again' });
    const message = special({ id: 'm', kind: 'message' });

    expect(adventSpecials([again, message])).toEqual([message]);
  });

  it('is empty without specials', () => {
    expect(adventSpecials([])).toEqual([]);
  });
});

describe('doorContent', () => {
  const aStudent = (overrides: Partial<Student> = {}): Student => ({
    id: 's-1',
    firstName: 'Anna',
    lastName: 'Bauer',
    color: null,
    pickCount: 0,
    ...overrides,
  });

  it('copies the name of a student', () => {
    expect(doorContent({ kind: 'student', studentId: 's-1' }, [aStudent({ id: 's-0' }), aStudent()])).toEqual(anna);
  });

  it('falls back to the id of a student who is not in the list', () => {
    expect(doorContent({ kind: 'student', studentId: 's-9' }, [aStudent()])).toEqual({
      kind: 'student',
      studentId: 's-9',
      name: 's-9',
    });
  });

  it('copies the label and color of a special', () => {
    const special = { id: 'p-1', label: 'Hausübung erlassen', color: '#059669', kind: 'message', probability: 5, showIn: 'always' } as const;

    expect(doorContent({ kind: 'special', special }, [])).toEqual(prize);
  });
});

// Keeps the shared helper used, and shows how a seeded shuffle looks.
it('shuffles repeatably with a seeded random', () => {
  const a = createCalendar(sequence(0.1, 0.5, 0.9, 0.3));
  const b = createCalendar(sequence(0.1, 0.5, 0.9, 0.3));

  expect(a.order).toEqual(b.order);
});
