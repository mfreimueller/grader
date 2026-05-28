import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { AdditionalInformation } from '../../../../src/domain/student/AdditionalInformation';

let validYear: SchoolYear;
let validClass: SchoolClass;
let validName: Name;
let validId: StudentId;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  validYear = year.value;
  validClass = new SchoolClass('class-1', '1A', validYear);

  const name = Name.create('Max', 'Mustermann');
  if (!name.ok) throw new Error('Test setup failed');
  validName = name.value;

  const id = StudentId.create('s-001');
  if (!id.ok) throw new Error('Test setup failed');
  validId = id.value;
});

describe('Student', () => {
  describe('create', () => {
    it('creates a student with id, name, and class', () => {
      const student = Student.create(validId, validName, validClass);
      expect(student.id.equals(validId)).toBe(true);
      expect(student.name.equals(validName)).toBe(true);
      expect(student.schoolClass.equals(validClass)).toBe(true);
      expect(student.additionalInformation).toEqual([]);
    });
  });

  describe('addInformation', () => {
    it('adds additional information to the student', () => {
      const student = Student.create(validId, validName, validClass);
      const info = new AdditionalInformation('email', 'max@example.com');
      student.addInformation(info);
      expect(student.additionalInformation).toHaveLength(1);
      expect(student.additionalInformation[0]?.key).toBe('email');
    });

    it('replaces information with the same key', () => {
      const student = Student.create(validId, validName, validClass);
      student.addInformation(new AdditionalInformation('email', 'old@example.com'));
      student.addInformation(new AdditionalInformation('email', 'new@example.com'));
      expect(student.additionalInformation).toHaveLength(1);
      expect(student.additionalInformation[0]?.value).toBe('new@example.com');
    });
  });

  describe('removeInformation', () => {
    it('removes information by key', () => {
      const student = Student.create(validId, validName, validClass);
      student.addInformation(new AdditionalInformation('email', 'max@example.com'));
      student.addInformation(new AdditionalInformation('phone', '+43123456789'));
      student.removeInformation('email');
      expect(student.additionalInformation).toHaveLength(1);
      expect(student.additionalInformation[0]?.key).toBe('phone');
    });

    it('does nothing when key does not exist', () => {
      const student = Student.create(validId, validName, validClass);
      student.addInformation(new AdditionalInformation('email', 'max@example.com'));
      student.removeInformation('nonexistent');
      expect(student.additionalInformation).toHaveLength(1);
    });
  });

  describe('changeClass', () => {
    it('changes the student class', () => {
      const student = Student.create(validId, validName, validClass);
      const newClass = new SchoolClass('class-2', '2A', validYear);
      student.changeClass(newClass);
      expect(student.schoolClass.id).toBe('class-2');
    });
  });

  describe('equals', () => {
    it('returns true for the same student id', () => {
      const a = Student.create(validId, validName, validClass);
      const b = Student.create(validId, validName, validClass);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different student ids', () => {
      const id2 = StudentId.create('s-002');
      if (!id2.ok) throw new Error('Test setup failed');
      const a = Student.create(validId, validName, validClass);
      const b = Student.create(id2.value, validName, validClass);
      expect(a.equals(b)).toBe(false);
    });
  });
});
