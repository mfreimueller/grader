import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';

let validYear: SchoolYear;

beforeAll(() => {
  const result = SchoolYear.create('2025/26');
  if (!result.ok) throw new Error('Test setup failed');
  validYear = result.value;
});

describe('SchoolClass', () => {
  describe('create', () => {
    it('creates a SchoolClass with id, name, and schoolYear', () => {
      const cls = new SchoolClass('class-1', '1A', validYear);
      expect(cls.id).toBe('class-1');
      expect(cls.name).toBe('1A');
      expect(cls.schoolYear.equals(validYear)).toBe(true);
    });
  });

  describe('equals', () => {
    it('returns true for SchoolClasses with same id', () => {
      const a = new SchoolClass('class-1', '1A', validYear);
      const b = new SchoolClass('class-1', '1B', validYear);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for SchoolClasses with different ids', () => {
      const a = new SchoolClass('class-1', '1A', validYear);
      const b = new SchoolClass('class-2', '1A', validYear);
      expect(a.equals(b)).toBe(false);
    });
  });
});
