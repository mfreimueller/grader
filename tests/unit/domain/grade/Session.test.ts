import { Session } from '../../../../src/domain/grade/Session';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';

let validClass: SchoolClass;
let validCourse: Course;
let student1: Student;
let student2: Student;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  validClass = new SchoolClass('class-1', '1A', year.value);
  validCourse = Course.create('course-1', 'Mathematik', validClass);

  const id1 = StudentId.create('s-001');
  const id2 = StudentId.create('s-002');
  const name1 = Name.create('Max', 'Mustermann');
  const name2 = Name.create('Anna', 'Musterfrau');
  if (!id1.ok || !id2.ok || !name1.ok || !name2.ok) throw new Error('Test setup failed');
  student1 = Student.create(id1.value, name1.value, validClass);
  student2 = Student.create(id2.value, name2.value, validClass);
});

describe('Session', () => {
  describe('create', () => {
    it('creates a session with id, date, notes, and course', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, 'Notes', validCourse);
      expect(session.id).toBe('sess-1');
      expect(session.date).toBe(date);
      expect(session.notes).toBe('Notes');
      expect(session.course.id).toBe('course-1');
    });

    it('starts with an empty student list', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, '', validCourse);
      expect(session.students).toEqual([]);
    });

    it('auto-creates a default "Mündlich" assessment', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, '', validCourse);
      expect(session.assessments).toHaveLength(1);
      expect(session.assessments[0]?.title).toBe('Mündlich');
      expect(session.assessments[0]?.isImpromptu).toBe(false);
    });
  });

  describe('addStudent', () => {
    it('adds a student to the session', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, '', validCourse);
      session.addStudent(student1);
      expect(session.students).toHaveLength(1);
      expect(session.students[0]?.id.equals(student1.id)).toBe(true);
    });

    it('does not add the same student twice', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, '', validCourse);
      session.addStudent(student1);
      session.addStudent(student1);
      expect(session.students).toHaveLength(1);
    });
  });

  describe('removeStudent', () => {
    it('removes a student from the session', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, '', validCourse);
      session.addStudent(student1);
      session.addStudent(student2);
      session.removeStudent(student1.id);
      expect(session.students).toHaveLength(1);
      expect(session.students[0]?.id.equals(student2.id)).toBe(true);
    });

    it('does nothing when student is not in the session', () => {
      const date = new Date(2025, 9, 15);
      const session = Session.create('sess-1', date, '', validCourse);
      session.addStudent(student1);
      // Trying to remove a non-existent StudentId does nothing
      const otherId = StudentId.create('s-999');
      expect(otherId.ok).toBe(true);
      if (otherId.ok) {
        session.removeStudent(otherId.value);
      }
      expect(session.students).toHaveLength(1);
    });
  });

  describe('absence', () => {
    const aSession = (): Session => Session.create('sess-1', new Date(2025, 9, 15), '', validCourse);

    it('starts with nobody absent', () => {
      const session = aSession();
      expect(session.absentStudentIds).toEqual([]);
      expect(session.isAbsent(student1.id)).toBe(false);
    });

    it('marks a student as absent', () => {
      const session = aSession();
      session.markAbsent(student1.id);
      expect(session.isAbsent(student1.id)).toBe(true);
      expect(session.isAbsent(student2.id)).toBe(false);
      expect(session.absentStudentIds).toEqual(['s-001']);
    });

    it('marks a student absent only once', () => {
      const session = aSession();
      session.markAbsent(student1.id);
      session.markAbsent(student1.id);
      expect(session.absentStudentIds).toEqual(['s-001']);
    });

    it('marks an absent student as present again', () => {
      const session = aSession();
      session.markAbsent(student1.id);
      session.markAbsent(student2.id);
      session.markPresent(student1.id);
      expect(session.isAbsent(student1.id)).toBe(false);
      expect(session.absentStudentIds).toEqual(['s-002']);
    });

    it('does nothing when marking a present student as present', () => {
      const session = aSession();
      session.markPresent(student1.id);
      expect(session.absentStudentIds).toEqual([]);
    });

    it('keeps the absence when a student is added to or removed from the session', () => {
      const session = aSession();
      session.markAbsent(student1.id);
      session.addStudent(student1);
      session.removeStudent(student1.id);
      expect(session.isAbsent(student1.id)).toBe(true);
    });

    it('does not expose its internal list to mutation', () => {
      const session = aSession();
      session.markAbsent(student1.id);
      (session.absentStudentIds as string[]).push('s-002');
      expect(session.absentStudentIds).toEqual(['s-001']);
    });

    it('restores the absent students when reconstituted', () => {
      const session = Session.reconstitute(
        'sess-1', new Date(2025, 9, 15), '', validCourse, [], [], ['s-001', 's-002', 's-001'],
      );
      expect(session.absentStudentIds).toEqual(['s-001', 's-002']);
      expect(session.isAbsent(student2.id)).toBe(true);
    });

    it('reconstitutes without absent students by default', () => {
      const session = Session.reconstitute('sess-1', new Date(2025, 9, 15), '', validCourse, [], []);
      expect(session.absentStudentIds).toEqual([]);
    });
  });

  describe('equals', () => {
    it('returns true for sessions with same id', () => {
      const date = new Date(2025, 9, 15);
      const a = Session.create('sess-1', date, '', validCourse);
      const b = Session.create('sess-1', date, 'Diff', validCourse);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for sessions with different ids', () => {
      const date = new Date(2025, 9, 15);
      const a = Session.create('sess-1', date, '', validCourse);
      const b = Session.create('sess-2', date, '', validCourse);
      expect(a.equals(b)).toBe(false);
    });
  });
});
