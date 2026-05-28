import { Grade } from '../../../../src/domain/grade/Grade';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';

let validClass: SchoolClass;
let validCourse: Course;
let student: Student;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  validClass = new SchoolClass('class-1', '1A', year.value);
  validCourse = Course.create('course-1', 'Mathematik', validClass);

  const id = StudentId.create('s-001');
  const name = Name.create('Max', 'Mustermann');
  if (!id.ok || !name.ok) throw new Error('Test setup failed');
  student = Student.create(id.value, name.value, validClass);
});

describe('Grade', () => {
  describe('create', () => {
    it('creates a grade with id, student, course, and score', () => {
      const result = Grade.create('g-1', student, validCourse, 2);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('g-1');
        expect(result.value.student.id.equals(student.id)).toBe(true);
        expect(result.value.course.id).toBe('course-1');
        expect(result.value.score).toBe(2);
      }
    });

    it('accepts score of 1', () => {
      const result = Grade.create('g-1', student, validCourse, 1);
      expect(result.ok).toBe(true);
    });

    it('accepts score of 5', () => {
      const result = Grade.create('g-1', student, validCourse, 5);
      expect(result.ok).toBe(true);
    });
  });

  describe('validation', () => {
    it('rejects score of 0', () => {
      const result = Grade.create('g-1', student, validCourse, 0);
      expect(result.ok).toBe(false);
    });

    it('rejects score of 6', () => {
      const result = Grade.create('g-1', student, validCourse, 6);
      expect(result.ok).toBe(false);
    });

    it('rejects negative score', () => {
      const result = Grade.create('g-1', student, validCourse, -1);
      expect(result.ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for grades with same id', () => {
      const a = Grade.create('g-1', student, validCourse, 2);
      const b = Grade.create('g-1', student, validCourse, 3);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('returns false for grades with different ids', () => {
      const a = Grade.create('g-1', student, validCourse, 2);
      const b = Grade.create('g-2', student, validCourse, 2);
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
