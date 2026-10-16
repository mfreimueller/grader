import { labelColor, layoutItems } from '../../../../plugins/studentpicker/src/core/layout';
import type { Special, Student } from '../../../../plugins/studentpicker/src/core/types';

const student = (id: string, firstName: string, lastName: string, color: string | null = null): Student => ({
  id,
  firstName,
  lastName,
  color,
  pickCount: 0,
});

const special = (id: string, overrides: Partial<Special> = {}): Special => ({
  id,
  label: id,
  color: '#6d28d9',
  kind: 'spin-again',
  probability: 5,
  showIn: 'always',
  ...overrides,
});

describe('layoutItems', () => {
  it('labels a student with the first name and the initial of the last name', () => {
    expect(layoutItems([student('a', 'Anna', 'Bauer')], [])).toEqual([
      { id: 'a', label: 'Anna B.', color: null, special: false, kind: null },
    ]);
  });

  it('keeps the own color of a student for the wheel', () => {
    expect(layoutItems([student('a', 'Anna', 'Bauer', '#112233')], [])[0]?.color).toBe('#112233');
  });

  it('sorts by last name, then first name, the German way', () => {
    const students = [student('3', 'Max', 'Zorn'), student('2', 'Zoe', 'Äpfel'), student('1', 'Anna', 'Äpfel'), student('4', 'Eva', 'Bauer')];

    expect(layoutItems(students, []).map((i) => i.id)).toEqual(['1', '2', '4', '3']);
  });

  it('spreads the specials evenly between the students', () => {
    const students = [student('s1', 'A', 'A'), student('s2', 'B', 'B'), student('s3', 'C', 'C'), student('s4', 'D', 'D')];

    const ids = layoutItems(students, [special('x'), special('y')]).map((i) => i.id);

    expect(ids).toEqual(['s1', 'x', 's2', 's3', 'y', 's4']);
  });

  it('puts a single special in the middle', () => {
    const students = [student('s1', 'A', 'A'), student('s2', 'B', 'B')];

    expect(layoutItems(students, [special('x')]).map((i) => i.id)).toEqual(['s1', 'x', 's2']);
  });

  it('tells specials and their kind apart from students', () => {
    const items = layoutItems([], [special('m', { kind: 'message', label: 'Test!' })]);

    expect(items).toEqual([{ id: 'm', label: 'Test!', color: '#6d28d9', special: true, kind: 'message' }]);
  });

  it('is empty without students and specials', () => {
    expect(layoutItems([], [])).toEqual([]);
  });
});

describe('labelColor', () => {
  it('uses white text on a dark background', () => {
    expect(labelColor('#000000')).toBe('#ffffff');
    expect(labelColor('#004a8d')).toBe('#ffffff');
    expect(labelColor('#ed1943')).toBe('#ffffff');
  });

  it('uses dark text on a light background', () => {
    expect(labelColor('#ffffff')).toBe('#111827');
    expect(labelColor('#fde047')).toBe('#111827');
  });
});
