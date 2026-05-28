import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { Session } from '../../../src/domain/grade/Session';
import { Course } from '../../../src/domain/grade/Course';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteSessionRepository', () => {
  let db: Db;
  let repo: SqliteSessionRepository;
  let course: Course;
  let student: Student;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteSessionRepository(db);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw new Error('SchoolYear creation failed');
    const schoolClass = new SchoolClass('class-1', '1A', year.value);

    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();

    course = Course.create('course-1', 'Mathematik', schoolClass);

    db.prepare(
      "INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('course-1:mitarbeit', 'Mitarbeit', 'TERTIARY', 0, 'course-1')",
    ).run();

    db.prepare(
      "INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-001', 'Max', 'Mustermann', 'class-1')",
    ).run();

    const idResult = StudentId.create('s-001');
    const nameResult = Name.create('Max', 'Mustermann');
    if (!idResult.ok || !nameResult.ok) throw new Error('Student creation failed');
    student = Student.create(idResult.value, nameResult.value, schoolClass);
  });

  afterEach(() => {
    db.close();
  });

  describe('save and findById', () => {
    it('persists a session and retrieves it by id', async () => {
      const session = Session.create('session-1', new Date('2025-10-01'), 'Notizen', course);
      await repo.save(session);

      const found = await repo.findById('session-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('session-1');
      expect(found!.date.toISOString()).toBe(new Date('2025-10-01').toISOString());
      expect(found!.notes).toBe('Notizen');
      expect(found!.course.id).toBe('course-1');
    });

    it('returns null for non-existent id', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('assessments', () => {
    it('persists and loads the auto-seeded Mündlich assessment', async () => {
      const session = Session.create('session-1', new Date('2025-10-01'), '', course);
      await repo.save(session);

      const found = await repo.findById('session-1');
      expect(found!.assessments).toHaveLength(1);
      expect(found!.assessments[0]!.title).toBe('Mündlich');
    });

    it('persists and loads additional assessments', async () => {
      const session = Session.create('session-1', new Date('2025-10-01'), '', course);
      await repo.save(session);

      db.prepare(
        "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-1', 'Test', 'NUMERIC', 1, 'course-1')",
      ).run();
      db.prepare(
        "INSERT INTO assessments (id, title, date, category_id, course_id, session_id) VALUES ('extra-001', 'Extra Test', '2025-10-01', 'cat-1', 'course-1', 'session-1')",
      ).run();

      const found = await repo.findById('session-1');
      expect(found!.assessments).toHaveLength(2);
    });
  });

  describe('students', () => {
    it('persists and loads session students', async () => {
      const session = Session.create('session-1', new Date('2025-10-01'), '', course);
      session.addStudent(student);
      await repo.save(session);

      const found = await repo.findById('session-1');
      expect(found!.students).toHaveLength(1);
      expect(found!.students[0]!.id.value).toBe('s-001');
    });
  });

  describe('findByCourse', () => {
    it('returns sessions sorted by date DESC', async () => {
      const s1 = Session.create('session-1', new Date('2025-10-01'), '', course);
      const s2 = Session.create('session-2', new Date('2025-10-15'), '', course);
      await repo.save(s1);
      await repo.save(s2);

      const found = await repo.findByCourse('course-1');
      expect(found).toHaveLength(2);
      expect(found[0]!.id).toBe('session-2');
      expect(found[1]!.id).toBe('session-1');
    });

    it('returns empty array for course with no sessions', async () => {
      const found = await repo.findByCourse('empty-course');
      expect(found).toEqual([]);
    });
  });

  describe('delete', () => {
    it('removes a session', async () => {
      const session = Session.create('session-1', new Date('2025-10-01'), '', course);
      await repo.save(session);

      await repo.delete('session-1');
      const found = await repo.findById('session-1');
      expect(found).toBeNull();
    });
  });
});
