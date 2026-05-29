import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { Grade } from '../../../src/domain/grade/Grade';
import { Course } from '../../../src/domain/grade/Course';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../src/domain/grade/GradingType';
import { GradedAssessment } from '../../../src/domain/grade/GradedAssessment';
import { GradedPerformance } from '../../../src/domain/grade/GradedPerformance';
import { ParticipationPerformance } from '../../../src/domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../../../src/domain/grade/ParticipationSymbol';
import { Assessment } from '../../../src/domain/grade/Assessment';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteGradeRepository', () => {
  let db: Db;
  let repo: SqliteGradeRepository;
  let schoolClass: SchoolClass;
  let course: Course;
  let student: Student;
  let category: AssessmentCategory;

  function seedMinimalData(): void {
    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();
    db.prepare(
      "INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-001', 'Max', 'Mustermann', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-1', 'Schularbeit', 'NUMERIC', 1, 'course-1')",
    ).run();
    db.prepare(
      "INSERT INTO grade_compositions (category_id, course_id, weight) VALUES ('cat-1', 'course-1', 80)",
    ).run();

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw new Error('SchoolYear creation failed');
    schoolClass = new SchoolClass('class-1', '1A', year.value);
    course = Course.create('course-1', 'Mathematik', schoolClass);
    category = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);

    const id = StudentId.create('s-001');
    const name = Name.create('Max', 'Mustermann');
    if (!id.ok || !name.ok) throw new Error('Student creation failed');
    student = Student.create(id.value, name.value, schoolClass);
  }

  function seedAssessment(assessmentId: string, maxPoints: number | null): void {
    db.prepare(
      `INSERT INTO sessions (id, date, notes, course_id) VALUES (?, ?, ?, ?)`,
    ).run(`session-${assessmentId}`, '2025-10-01', '', 'course-1');
    db.prepare(
      `INSERT INTO assessments (id, title, category_id, course_id, is_impromptu, max_points, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(assessmentId, 'Test', 'cat-1', 'course-1', 0, maxPoints, `session-${assessmentId}`);
  }

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteGradeRepository(db);
    seedMinimalData();
  });

  afterEach(() => {
    db.close();
  });

  describe('Grade CRUD', () => {
    it('saves and finds a grade by student', async () => {
      const grade = Grade.create('g-001', student, course, 2);
      if (!grade.ok) throw new Error('Grade create failed');

      await repo.save(grade.value);
      const found = await repo.findByStudent(student.id);

      expect(found).toHaveLength(1);
      expect(found[0]!.score).toBe(2);
    });

    it('finds a grade by course and student', async () => {
      const grade = Grade.create('g-001', student, course, 3);
      if (!grade.ok) throw new Error('Grade create failed');

      await repo.save(grade.value);
      const found = await repo.findByCourseAndStudent('course-1', student.id);

      expect(found).not.toBeNull();
      expect(found!.score).toBe(3);
    });

    it('returns null when no grade exists for course and student', async () => {
      const found = await repo.findByCourseAndStudent('course-1', student.id);
      expect(found).toBeNull();
    });

    it('soft-deletes a grade (record stays in DB but excluded from queries)', async () => {
      const grade = Grade.create('g-001', student, course, 2);
      if (!grade.ok) throw new Error('Grade create failed');
      await repo.save(grade.value);

      await repo.delete('g-001');
      const found = await repo.findByStudent(student.id);
      expect(found).toHaveLength(0);

      const raw = db.prepare('SELECT id, deleted_at FROM grades WHERE id = ?').get('g-001') as {
        id: string;
        deleted_at: string | null;
      };
      expect(raw).not.toBeUndefined();
      expect(raw.deleted_at).not.toBeNull();
    });

    it('updates an existing grade on save', async () => {
      const grade = Grade.create('g-001', student, course, 2);
      if (!grade.ok) throw new Error('Grade create failed');
      await repo.save(grade.value);

      const updated = Grade.create('g-001', student, course, 4);
      if (!updated.ok) throw new Error('Grade create failed');
      await repo.save(updated.value);

      const found = await repo.findByCourseAndStudent('course-1', student.id);
      expect(found!.score).toBe(4);
    });
  });

  describe('StudentPerformance CRUD', () => {
    it('saves and finds graded performances by assessment', async () => {
      seedAssessment('a-001', 30);

      const assessmentResult = GradedAssessment.create(
        'a-001', 'Test', category, course, 'session-a-001', 30,
      );
      if (!assessmentResult.ok) throw new Error('Assessment create failed');

      const perf = GradedPerformance.create(
        'p-001', student, assessmentResult.value, 24,
      );
      if (!perf.ok) throw new Error('Performance create failed');

      await repo.savePerformance(perf.value);

      const found = await repo.findPerformancesByAssessment('a-001');
      expect(found).toHaveLength(1);
    });

    it('saves and finds participation performances by assessment', async () => {
      seedAssessment('a-002', null);

      const assessment = new Assessment(
        'a-002', 'Mündlich', category, course, 'session-a-002',
      );
      const symbol = ParticipationSymbol.create('PLUS');
      if (!symbol.ok) throw new Error('Symbol create failed');

      const perf = ParticipationPerformance.create(
        'p-002', student, assessment, symbol.value,
      );
      if (!perf.ok) throw new Error('Performance create failed');

      await repo.savePerformance(perf.value);

      const found = await repo.findPerformancesByAssessment('a-002');
      expect(found).toHaveLength(1);
    });

    it('finds performances by student', async () => {
      seedAssessment('a-003', null);

      const assessment = new Assessment(
        'a-003', 'Mündlich', category, course, 'session-a-003',
      );
      const symbol = ParticipationSymbol.create('PLUS');
      if (!symbol.ok) throw new Error('Symbol create failed');
      const perf = ParticipationPerformance.create(
        'p-003', student, assessment, symbol.value,
      );
      if (!perf.ok) throw new Error('Performance create failed');
      await repo.savePerformance(perf.value);

      const found = await repo.findPerformancesByStudent(student.id);
      expect(found).toHaveLength(1);
    });
  });
});
