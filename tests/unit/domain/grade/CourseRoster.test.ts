import { CourseRoster } from '../../../../src/domain/grade/CourseRoster';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';

const year = SchoolYear.create('2026/27');
if (!year.ok) throw new Error('test setup failed');
const schoolClass = new SchoolClass('class-1', '4A', year.value);

const aStudent = (id: string, firstName: string, lastName: string, deletedAt: string | null = null): Student => {
  const sid = StudentId.create(id);
  const name = Name.create(firstName, lastName);
  if (!sid.ok || !name.ok) throw new Error('test setup failed');
  return Student.create(sid.value, name.value, schoolClass, deletedAt);
};

const ids = (students: Student[]): string[] => students.map((s) => s.id.value);

describe('CourseRoster', () => {
  describe('of', () => {
    const anna = aStudent('a', 'Anna', 'Gruber');
    const max = aStudent('m', 'Max', 'Muster');
    const zoe = aStudent('z', 'Zoe', 'Zimmer');

    it('contains the whole class when nobody is excluded', () => {
      expect(ids(CourseRoster.of([max, anna, zoe], new Set()))).toEqual(['a', 'm', 'z']);
    });

    it('leaves out excluded students', () => {
      expect(ids(CourseRoster.of([anna, max, zoe], new Set(['m'])))).toEqual(['a', 'z']);
    });

    it('never contains deleted students', () => {
      const gone = aStudent('g', 'Eva', 'Alt', '2026-01-01');

      expect(ids(CourseRoster.of([gone, anna], new Set()))).toEqual(['a']);
    });

    it('sorts by last name, then first name', () => {
      const berta = aStudent('b', 'Berta', 'Gruber');

      expect(ids(CourseRoster.of([zoe, berta, anna], new Set()))).toEqual(['a', 'b', 'z']);
    });

    it('ignores exclusions of students that are not in the class', () => {
      expect(ids(CourseRoster.of([anna], new Set(['unknown'])))).toEqual(['a']);
    });

    it('is empty for an empty class', () => {
      expect(CourseRoster.of([], new Set())).toEqual([]);
    });

    it('does not reorder or change the input list', () => {
      const input = [zoe, anna];

      CourseRoster.of(input, new Set());

      expect(ids(input)).toEqual(['z', 'a']);
    });
  });
});
