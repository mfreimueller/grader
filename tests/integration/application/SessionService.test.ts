import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SessionService } from '../../../src/application/SessionService';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';
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
  let rosterRepo: SqliteCourseRosterRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    rosterRepo = new SqliteCourseRosterRepository(db);
    service = new SessionService(
      sessionRepo, courseRepo, studentRepo,
      new CourseRosterService(courseRepo, studentRepo, rosterRepo),
    );

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

  it('creates a session', async () => {
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

  describe('setStudentNote', () => {
    const createSession = async (): Promise<string> => {
      const created = await service.create({ courseId, date: '2025-10-01T00:00:00.000Z' });
      if (!created.ok) throw created.error;
      return created.value.id;
    };

    it('creates sessions without student notes', async () => {
      const result = await service.create({ courseId, date: '2025-10-01T00:00:00.000Z' });
      if (!result.ok) throw result.error;
      expect(result.value.studentNotes).toEqual([]);
    });

    it('stores a note for a student and persists it', async () => {
      const sessionId = await createSession();

      const result = await service.setStudentNote(sessionId, studentId, 'beteiligt sich nicht');

      if (!result.ok) throw result.error;
      expect(result.value.studentNotes).toEqual([{ studentId, text: 'beteiligt sich nicht' }]);
      expect((await service.listByCourse(courseId))[0]!.studentNotes).toEqual([{ studentId, text: 'beteiligt sich nicht' }]);
    });

    it('removes the note for blank text', async () => {
      const sessionId = await createSession();
      await service.setStudentNote(sessionId, studentId, 'ruhig');

      const result = await service.setStudentNote(sessionId, studentId, '');

      if (!result.ok) throw result.error;
      expect(result.value.studentNotes).toEqual([]);
    });

    it('keeps the absence and the note independent', async () => {
      const sessionId = await createSession();
      await service.setStudentNote(sessionId, studentId, 'ruhig');
      const result = await service.setAbsence(sessionId, studentId, true);
      if (!result.ok) throw result.error;
      expect(result.value.studentNotes).toEqual([{ studentId, text: 'ruhig' }]);
    });

    it('fails for an unknown session', async () => {
      const result = await service.setStudentNote('missing', studentId, 'x');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('fails for an unknown student', async () => {
      const result = await service.setStudentNote(await createSession(), 'nobody', 'x');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('rejects a note for a student who is not taught in the course', async () => {
      const sessionId = await createSession();
      await rosterRepo.setExcluded(courseId, studentId, true);
      const result = await service.setStudentNote(sessionId, studentId, 'x');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('rejects a note that is too long', async () => {
      const result = await service.setStudentNote(await createSession(), studentId, 'x'.repeat(2001));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });
  });

  describe('setAbsence', () => {
    const createSession = async (): Promise<string> => {
      const created = await service.create({ courseId, date: '2025-10-01T00:00:00.000Z' });
      if (!created.ok) throw created.error;
      return created.value.id;
    };

    it('creates sessions with nobody absent', async () => {
      const result = await service.create({ courseId, date: '2025-10-01T00:00:00.000Z' });
      if (!result.ok) throw result.error;
      expect(result.value.absentStudentIds).toEqual([]);
    });

    it('marks a student of the roster as absent and persists it', async () => {
      const sessionId = await createSession();

      const result = await service.setAbsence(sessionId, studentId, true);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.absentStudentIds).toEqual([studentId]);
      const listed = await service.listByCourse(courseId);
      expect(listed[0]!.absentStudentIds).toEqual([studentId]);
    });

    it('marks an absent student as present again', async () => {
      const sessionId = await createSession();
      await service.setAbsence(sessionId, studentId, true);

      const result = await service.setAbsence(sessionId, studentId, false);

      if (!result.ok) throw result.error;
      expect(result.value.absentStudentIds).toEqual([]);
    });

    it('is idempotent', async () => {
      const sessionId = await createSession();
      await service.setAbsence(sessionId, studentId, true);
      const again = await service.setAbsence(sessionId, studentId, true);
      if (!again.ok) throw again.error;
      expect(again.value.absentStudentIds).toEqual([studentId]);

      const present = await service.setAbsence(sessionId, studentId, false);
      const presentAgain = await service.setAbsence(sessionId, studentId, false);
      expect(present.ok && presentAgain.ok).toBe(true);
    });

    it('fails for an unknown session', async () => {
      const result = await service.setAbsence('missing', studentId, true);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('fails for an unknown student', async () => {
      const sessionId = await createSession();
      const result = await service.setAbsence(sessionId, 'nobody', true);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('fails for an empty student id', async () => {
      const sessionId = await createSession();
      const result = await service.setAbsence(sessionId, '', true);
      expect(result.ok).toBe(false);
    });

    it('rejects marking a student absent who is not taught in the course', async () => {
      const sessionId = await createSession();
      await rosterRepo.setExcluded(courseId, studentId, true);

      const result = await service.setAbsence(sessionId, studentId, true);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('still lets a student who left the roster be marked present again', async () => {
      const sessionId = await createSession();
      await service.setAbsence(sessionId, studentId, true);
      await rosterRepo.setExcluded(courseId, studentId, true);

      const result = await service.setAbsence(sessionId, studentId, false);

      if (!result.ok) throw result.error;
      expect(result.value.absentStudentIds).toEqual([]);
    });
  });

  describe('findOnDate', () => {
    it('returns null and creates nothing when the course has no session on the date', async () => {
      const result = await service.findOnDate(courseId, '2026-10-12');

      expect(result).toBeNull();
      expect(await service.listByCourse(courseId)).toEqual([]);
    });

    it('returns the session on the date', async () => {
      const existing = await service.create({ courseId, date: '2026-10-12', notes: 'x' });
      if (!existing.ok) throw existing.error;
      await service.create({ courseId, date: '2026-10-13' });

      const result = await service.findOnDate(courseId, '2026-10-12');

      expect(result?.id).toBe(existing.value.id);
    });

    it('picks the session with the smallest id when several exist on the date', async () => {
      const a = await service.create({ courseId, date: '2026-10-12' });
      const b = await service.create({ courseId, date: '2026-10-12' });
      if (!a.ok || !b.ok) throw new Error('expected sessions to be created');

      const result = await service.findOnDate(courseId, '2026-10-12');

      expect(result?.id).toBe([a.value.id, b.value.id].sort()[0]);
    });
  });

  describe('findOrCreateOnDate', () => {
    it('creates a session on the date when the course has none', async () => {
      const result = await service.findOrCreateOnDate(courseId, '2026-10-12');

      if (!result.ok) throw result.error;
      expect(result.value.date).toBe('2026-10-12T00:00:00.000Z');
      expect(result.value.courseId).toBe(courseId);
      expect(result.value.notes).toBe('');
      expect(await service.listByCourse(courseId)).toHaveLength(1);
    });

    it('returns the session that already exists on the date instead of creating another', async () => {
      const existing = await service.create({ courseId, date: '2026-10-12', notes: 'Wiederholung' });
      if (!existing.ok) throw existing.error;

      const result = await service.findOrCreateOnDate(courseId, '2026-10-12');

      if (!result.ok) throw result.error;
      expect(result.value.id).toBe(existing.value.id);
      expect(result.value.notes).toBe('Wiederholung');
      expect(await service.listByCourse(courseId)).toHaveLength(1);
    });

    it('finds a session whose stored date carries a time of day', async () => {
      const existing = await service.create({ courseId, date: '2026-10-12T00:00:00.000Z' });
      if (!existing.ok) throw existing.error;

      const result = await service.findOrCreateOnDate(courseId, '2026-10-12');

      expect(result.ok && result.value.id).toBe(existing.value.id);
    });

    it('is idempotent', async () => {
      const first = await service.findOrCreateOnDate(courseId, '2026-10-12');
      const second = await service.findOrCreateOnDate(courseId, '2026-10-12');

      if (!first.ok || !second.ok) throw new Error('expected both calls to succeed');
      expect(second.value.id).toBe(first.value.id);
      expect(await service.listByCourse(courseId)).toHaveLength(1);
    });

    it('creates a new session when only other days exist', async () => {
      await service.create({ courseId, date: '2026-10-11' });
      await service.create({ courseId, date: '2026-10-13' });

      const result = await service.findOrCreateOnDate(courseId, '2026-10-12');

      if (!result.ok) throw result.error;
      expect(await service.listByCourse(courseId)).toHaveLength(3);
    });

    it('does not reuse a session of another course', async () => {
      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw year.error;
      const otherCourse = Course.create('course-2', 'Physik', new SchoolClass('class-1', '1A', year.value));
      new SqliteCourseRepository(db).save(otherCourse);
      const other = await service.create({ courseId: 'course-2', date: '2026-10-12' });
      if (!other.ok) throw other.error;

      const result = await service.findOrCreateOnDate(courseId, '2026-10-12');

      if (!result.ok) throw result.error;
      expect(result.value.id).not.toBe(other.value.id);
      expect(result.value.courseId).toBe(courseId);
    });

    it('picks the same session every time when several exist on the date', async () => {
      const a = await service.create({ courseId, date: '2026-10-12' });
      const b = await service.create({ courseId, date: '2026-10-12' });
      if (!a.ok || !b.ok) throw new Error('expected sessions to be created');
      const smallestId = [a.value.id, b.value.id].sort()[0];

      const result = await service.findOrCreateOnDate(courseId, '2026-10-12');

      expect(result.ok && result.value.id).toBe(smallestId);
    });

    it('fails for a course that does not exist', async () => {
      const result = await service.findOrCreateOnDate('nope', '2026-10-12');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it.each(['', '12.10.2026', '2026-10-12T00:00:00.000Z', '2026-1-2', '2026-13-01', '2026-02-30', 'heute'])(
      'rejects the date %p',
      async (date) => {
        const result = await service.findOrCreateOnDate(courseId, date);

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
        expect(await service.listByCourse(courseId)).toEqual([]);
      },
    );
  });
});
