import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SessionService } from '../../../src/application/SessionService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SessionService', () => {
  let db: Db;
  let service: SessionService;
  let courseId: string;
  let studentId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    service = new SessionService(sessionRepo, courseRepo, studentRepo);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    courseRepo.save(course);
    courseId = 'course-1';

    const sid = StudentId.create('s-001');
    if (!sid.ok) throw sid.error;
    const name = Name.create('Max', 'Mustermann');
    if (!name.ok) throw name.error;
    const student = Student.create(sid.value, name.value, schoolClass);
    studentRepo.save(student);
    studentId = 's-001';
  });

  afterEach(() => {
    db.close();
  });

  it('lists sessions (empty)', async () => {
    const list = await service.listByCourse(courseId);
    expect(list).toEqual([]);
  });

  it('creates a session with Mündlich assessment', async () => {
    const result = await service.create({
      courseId,
      date: '2025-10-01T00:00:00.000Z',
      notes: 'Erste Stunde',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.notes).toBe('Erste Stunde');
  });

  it('creates a session with students', async () => {
    const result = await service.create({
      courseId,
      date: '2025-10-01T00:00:00.000Z',
      notes: '',
      studentIds: [studentId],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.studentIds).toContain(studentId);
  });

  it('deletes a session', async () => {
    const created = await service.create({ courseId, date: '2025-10-01T00:00:00.000Z' });
    if (!created.ok) return;
    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);
  });
});
