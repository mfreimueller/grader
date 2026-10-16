import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqlitePluginAssessmentRepository } from '../../../src/infrastructure/persistence/SqlitePluginAssessmentRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { AssessmentCategoryService } from '../../../src/application/AssessmentCategoryService';
import { AssessmentService } from '../../../src/application/AssessmentService';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { CourseService } from '../../../src/application/CourseService';
import { GradingService } from '../../../src/application/GradingService';
import { ImpromptuAssessmentService } from '../../../src/application/ImpromptuAssessmentService';
import { NotInCourseError, PluginCaller, PluginPermissionDeniedError } from '../../../src/application/PluginCaller';
import { PluginHostService } from '../../../src/application/PluginHostService';
import { SessionService } from '../../../src/application/SessionService';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import { PluginAssessmentRepository } from '../../../src/domain/plugin/PluginAssessmentRepository';
import { AssessmentRepository } from '../../../src/domain/grade/AssessmentRepository';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { Course } from '../../../src/domain/grade/Course';
import { GradingType } from '../../../src/domain/grade/GradingType';
import { Color } from '../../../src/domain/student/Color';
import { Name } from '../../../src/domain/student/Name';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';
import type { CreateImpromptuRequest } from '../../../src/shared/plugin-api';
import type { Db } from '../../../src/infrastructure/persistence/db';
import type { Result } from '../../../src/domain/shared/Result';

const ALL_PERMISSIONS = ['course:read', 'storage', 'assessment:impromptu'];

const aCaller = (
  overrides: { id?: string; courseId?: string; permissions?: string[] } = {},
): PluginCaller => {
  const manifest = PluginManifest.create({
    id: overrides.id ?? 'at.example.tool',
    name: 'Tool',
    version: '2.3.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: overrides.permissions ?? ALL_PERMISSIONS,
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return { manifest: manifest.value, courseId: overrides.courseId ?? 'course-1' };
};

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

function errorOf<T>(result: Result<T>): Error {
  if (result.ok) throw new Error('expected a failure');
  return result.error;
}

const count = (db: Db, table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number }).cnt;

describe('PluginHostService', () => {
  let db: Db;
  let now: Date;
  let host: PluginHostService;
  let sessionService: SessionService;
  let assessmentService: AssessmentService;
  let pluginAssessmentRepo: SqlitePluginAssessmentRepository;
  let mitarbeitId: string;
  let schularbeitId: string;
  let otherCourseMitarbeitId: string;

  const build = (
    stubs: { pluginAssessments?: PluginAssessmentRepository; assessmentRepo?: AssessmentRepository } = {},
  ): PluginHostService => {
    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const assessmentRepo = new SqliteAssessmentRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    const rosterRepo = new SqliteCourseRosterRepository(db);

    const rosterService = new CourseRosterService(courseRepo, studentRepo, rosterRepo);
    sessionService = new SessionService(sessionRepo, courseRepo, studentRepo, rosterService);
    assessmentService = new AssessmentService(assessmentRepo, sessionRepo, courseRepo);
    const gradingService = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, assessmentRepo, sessionRepo);
    pluginAssessmentRepo = new SqlitePluginAssessmentRepository(db);

    return new PluginHostService({
      courseService: new CourseService(courseRepo, classRepo, rosterRepo),
      rosterService,
      categoryService: new AssessmentCategoryService(courseRepo),
      sessionService,
      assessmentService,
      impromptuService: new ImpromptuAssessmentService(assessmentService, gradingService),
      assessmentRepo: stubs.assessmentRepo ?? assessmentRepo,
      pluginAssessmentRepo: stubs.pluginAssessments ?? pluginAssessmentRepo,
      now: () => now,
    });
  };

  beforeEach(async () => {
    db = createInMemoryDb();
    runMigrations(db);
    now = new Date(2026, 9, 12, 8, 30); // local time: 12 October 2026

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);

    const year = SchoolYear.create('2026/27');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    const otherClass = new SchoolClass('class-2', '2B', year.value);
    classRepo.save(schoolClass);
    classRepo.save(otherClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    course.addAssessmentCategory(new AssessmentCategory('cat-sa', 'Schularbeit', GradingType.NUMERIC, true));
    courseRepo.save(course);
    courseRepo.save(Course.create('course-2', 'Physik', schoolClass));
    mitarbeitId = course.getMitarbeitCategory()!.id;
    schularbeitId = 'cat-sa';
    otherCourseMitarbeitId = (await courseRepo.findById('course-2'))!.getMitarbeitCategory()!.id;

    const addStudent = (id: string, first: string, last: string, cls: SchoolClass, color?: string): void => {
      const sid = StudentId.create(id);
      const name = Name.create(first, last);
      if (!sid.ok) throw sid.error;
      if (!name.ok) throw name.error;
      const student = Student.create(sid.value, name.value, cls);
      if (color) {
        const c = Color.create(color);
        if (!c.ok) throw c.error;
        student.changeColor(c.value);
      }
      studentRepo.save(student);
    };
    addStudent('s-zorn', 'Zoe', 'Zorn', schoolClass);
    addStudent('s-bauer', 'Anna', 'Bauer', schoolClass, '#ed1943');
    addStudent('s-muster', 'Max', 'Muster', schoolClass);
    addStudent('s-other', 'Olga', 'Fremd', otherClass);

    host = build();
  });

  afterEach(() => {
    db.close();
  });

  describe('context', () => {
    it('is denied without the course:read permission', async () => {
      const result = await host.context(aCaller({ permissions: ['storage'] }));

      expect(errorOf(result)).toBeInstanceOf(PluginPermissionDeniedError);
    });

    it('describes the plugin, the course, the class, the school year and today', async () => {
      const context = valueOf(await host.context(aCaller()));

      expect(context).toMatchObject({
        apiVersion: 1,
        plugin: { id: 'at.example.tool', version: '2.3.0' },
        course: { id: 'course-1', title: 'Mathematik' },
        schoolClass: { id: 'class-1', name: '1A' },
        schoolYear: '2026/27',
        today: '2026-10-12',
      });
    });

    it('takes today from the local calendar day, not from UTC', async () => {
      now = new Date(2026, 9, 12, 23, 59);
      expect(valueOf(await host.context(aCaller())).today).toBe('2026-10-12');

      now = new Date(2026, 9, 13, 0, 1);
      expect(valueOf(await host.context(aCaller())).today).toBe('2026-10-13');
    });

    it('lists the taught students by name with their color', async () => {
      const { students } = valueOf(await host.context(aCaller()));

      expect(students).toEqual([
        { id: 's-bauer', firstName: 'Anna', lastName: 'Bauer', color: '#ed1943' },
        { id: 's-muster', firstName: 'Max', lastName: 'Muster', color: null },
        { id: 's-zorn', firstName: 'Zoe', lastName: 'Zorn', color: null },
      ]);
    });

    it('leaves out students who are not taught in the course', async () => {
      await new SqliteCourseRosterRepository(db).setExcluded('course-1', 's-muster', true);

      const { students } = valueOf(await host.context(aCaller()));

      expect(students.map((s) => s.id)).toEqual(['s-bauer', 's-zorn']);
    });

    it('leaves out students marked absent in today\'s session', async () => {
      const today = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-10-12'));
      await sessionService.setAbsence(today.id, 's-muster', true);

      const { students } = valueOf(await host.context(aCaller()));

      expect(students.map((s) => s.id)).toEqual(['s-bauer', 's-zorn']);
    });

    describe('courseStudents', () => {
      it('lists everybody taught in the course, absent today or not', async () => {
        const today = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-10-12'));
        await sessionService.setAbsence(today.id, 's-muster', true);

        const { students, courseStudents } = valueOf(await host.context(aCaller()));

        expect(students.map((s) => s.id)).toEqual(['s-bauer', 's-zorn']);
        expect(courseStudents).toEqual([
          { id: 's-bauer', firstName: 'Anna', lastName: 'Bauer', color: '#ed1943' },
          { id: 's-muster', firstName: 'Max', lastName: 'Muster', color: null },
          { id: 's-zorn', firstName: 'Zoe', lastName: 'Zorn', color: null },
        ]);
      });

      it('equals students when nobody is absent', async () => {
        const context = valueOf(await host.context(aCaller()));

        expect(context.courseStudents).toEqual(context.students);
      });

      it('still leaves out students who are not taught in the course, and students of other courses', async () => {
        await new SqliteCourseRosterRepository(db).setExcluded('course-1', 's-muster', true);

        const { courseStudents } = valueOf(await host.context(aCaller()));

        expect(courseStudents.map((s) => s.id)).toEqual(['s-bauer', 's-zorn']);
      });
    });

    it('lists everybody when there is no session today', async () => {
      const { students } = valueOf(await host.context(aCaller()));

      expect(students).toHaveLength(3);
    });

    it('ignores absences from other days and other courses', async () => {
      const yesterday = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-10-11'));
      await sessionService.setAbsence(yesterday.id, 's-muster', true);
      const otherCourseToday = valueOf(await sessionService.findOrCreateOnDate('course-2', '2026-10-12'));
      await sessionService.setAbsence(otherCourseToday.id, 's-zorn', true);

      const { students } = valueOf(await host.context(aCaller()));

      expect(students).toHaveLength(3);
    });

    it('does not create a session just by being opened', async () => {
      await host.context(aCaller());

      expect(count(db, 'sessions')).toBe(0);
    });

    it('lists the categories and marks Mitarbeit', async () => {
      const { categories } = valueOf(await host.context(aCaller()));

      expect(categories).toEqual(
        expect.arrayContaining([
          { id: mitarbeitId, title: 'Mitarbeit', gradingType: 'TERTIARY', isMitarbeit: true, isHidden: false },
          { id: schularbeitId, title: 'Schularbeit', gradingType: 'NUMERIC', isMitarbeit: false, isHidden: false },
        ]),
      );
      expect(categories).toHaveLength(2);
    });

    it('lists the sessions of the course newest first with plain dates', async () => {
      await sessionService.create({ courseId: 'course-1', date: '2026-10-05', notes: 'alt' });
      await sessionService.create({ courseId: 'course-1', date: '2026-10-09', notes: 'neu' });
      await sessionService.create({ courseId: 'course-2', date: '2026-10-10' });

      const { sessions } = valueOf(await host.context(aCaller()));

      expect(sessions.map((s) => [s.date, s.notes])).toEqual([
        ['2026-10-09', 'neu'],
        ['2026-10-05', 'alt'],
      ]);
    });

    it('fails for a course that does not exist', async () => {
      const result = await host.context(aCaller({ courseId: 'gone' }));

      expect(errorOf(result)).toBeInstanceOf(NotFoundError);
    });
  });

  describe('createImpromptu', () => {
    // `symbol: undefined` in an override removes the default symbol, like an omitted field would.
    const create = (overrides: Record<string, unknown> = {}, caller = aCaller()) =>
      host.createImpromptu(caller, {
        studentId: 's-muster',
        categoryId: mitarbeitId,
        symbol: 'PLUS',
        ...overrides,
      } as CreateImpromptuRequest);

    it('is denied without the assessment:impromptu permission and creates nothing', async () => {
      const result = await create({}, aCaller({ permissions: ['course:read'] }));

      expect(errorOf(result)).toBeInstanceOf(PluginPermissionDeniedError);
      expect(count(db, 'sessions')).toBe(0);
      expect(count(db, 'assessments')).toBe(0);
    });

    it('records the symbol for the student in today\'s session, which it creates when missing', async () => {
      const created = valueOf(await create());

      const sessions = await sessionService.listByCourse('course-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.date).toBe('2026-10-12T00:00:00.000Z');
      expect(created.sessionId).toBe(sessions[0]?.id);

      const assessments = await assessmentService.listBySession(created.sessionId);
      expect(assessments).toHaveLength(1);
      expect(assessments[0]).toMatchObject({
        id: created.assessmentId,
        title: 'Mitarbeit',
        isImpromptu: true,
        courseId: 'course-1',
        category: { id: mitarbeitId },
      });
      expect(
        db.prepare('SELECT student_id, symbol FROM student_performances WHERE id = ?').get(created.performanceId),
      ).toEqual({ student_id: 's-muster', symbol: 'PLUS' });
    });

    it('reuses the session of today when there is one', async () => {
      const today = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-10-12'));

      const created = valueOf(await create());

      expect(created.sessionId).toBe(today.id);
      expect(count(db, 'sessions')).toBe(1);
    });

    it('uses the given title', async () => {
      const created = valueOf(await create({ title: 'Wortmeldung' }));

      const [assessment] = await assessmentService.listBySession(created.sessionId);
      expect(assessment?.title).toBe('Wortmeldung');
    });

    it('remembers that the plugin created the assessment', async () => {
      const created = valueOf(await create());

      expect(await pluginAssessmentRepo.isCreatedBy(aCaller().manifest.id, created.assessmentId)).toBe(true);
    });

    it('records graded points when a maximum is given', async () => {
      const created = valueOf(await create({ symbol: undefined, score: 8, maxPoints: 10 }));

      expect(
        db.prepare('SELECT score FROM student_performances WHERE id = ?').get(created.performanceId),
      ).toEqual({ score: 8 });
    });

    describe('session target', () => {
      it('puts the assessment on a past day, creating that day\'s session', async () => {
        const created = valueOf(await create({ session: { kind: 'date', date: '2026-09-30' } }));

        const sessions = await sessionService.listByCourse('course-1');
        expect(sessions.map((s) => s.date)).toEqual(['2026-09-30T00:00:00.000Z']);
        expect(created.sessionId).toBe(sessions[0]?.id);
      });

      it('reuses the session that already exists on that day', async () => {
        const past = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-09-30'));

        const created = valueOf(await create({ session: { kind: 'date', date: '2026-09-30' } }));

        expect(created.sessionId).toBe(past.id);
        expect(count(db, 'sessions')).toBe(1);
      });

      it('accepts today as a date', async () => {
        expect((await create({ session: { kind: 'date', date: '2026-10-12' } })).ok).toBe(true);
      });

      it('rejects a day in the future and creates nothing', async () => {
        const result = await create({ session: { kind: 'date', date: '2026-10-13' } });

        expect(errorOf(result)).toBeInstanceOf(ValidationError);
        expect(count(db, 'sessions')).toBe(0);
        expect(count(db, 'assessments')).toBe(0);
      });

      it.each(['12.10.2026', '2026-02-30', '', 'heute'])('rejects the date %p', async (date) => {
        const result = await create({ session: { kind: 'date', date } });

        expect(errorOf(result)).toBeInstanceOf(ValidationError);
        expect(count(db, 'sessions')).toBe(0);
      });

      it('puts the assessment into an existing session of the course', async () => {
        const session = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-10-05'));

        const created = valueOf(await create({ session: { kind: 'session', sessionId: session.id } }));

        expect(created.sessionId).toBe(session.id);
        expect(count(db, 'sessions')).toBe(1);
      });

      it('refuses a session of another course', async () => {
        const other = valueOf(await sessionService.findOrCreateOnDate('course-2', '2026-10-05'));

        const result = await create({ session: { kind: 'session', sessionId: other.id } });

        expect(errorOf(result)).toBeInstanceOf(NotInCourseError);
        expect(count(db, 'assessments')).toBe(0);
      });

      it('refuses a session that does not exist', async () => {
        const result = await create({ session: { kind: 'session', sessionId: 'nope' } });

        expect(errorOf(result)).toBeInstanceOf(NotInCourseError);
      });
    });

    describe('student and category', () => {
      it.each([
        ['a student of another class', 's-other'],
        ['an unknown student', 's-unknown'],
      ])('refuses %s', async (_label, studentId) => {
        const result = await create({ studentId });

        expect(errorOf(result)).toBeInstanceOf(NotInCourseError);
        expect(count(db, 'sessions')).toBe(0);
        expect(count(db, 'assessments')).toBe(0);
      });

      it('refuses a student who is not taught in the course', async () => {
        await new SqliteCourseRosterRepository(db).setExcluded('course-1', 's-muster', true);

        const result = await create();

        expect(errorOf(result)).toBeInstanceOf(NotInCourseError);
      });

      it.each([
        ['a category of another course', () => otherCourseMitarbeitId],
        ['an unknown category', () => 'cat-unknown'],
      ])('refuses %s', async (_label, categoryId) => {
        const result = await create({ categoryId: categoryId() });

        expect(errorOf(result)).toBeInstanceOf(NotInCourseError);
        expect(count(db, 'sessions')).toBe(0);
        expect(count(db, 'assessments')).toBe(0);
      });
    });

    describe('values', () => {
      it.each([
        ['an unknown symbol', { symbol: 'GUT' }],
        ['a score without a maximum', { symbol: undefined, score: 5 }],
        ['a maximum without a score', { symbol: undefined, maxPoints: 10 }],
        ['a score above the maximum', { symbol: undefined, score: 11, maxPoints: 10 }],
        ['a negative score', { symbol: undefined, score: -1, maxPoints: 10 }],
        ['a fractional score', { symbol: undefined, score: 1.5, maxPoints: 10 }],
        ['a fractional maximum', { symbol: undefined, score: 1, maxPoints: 2.5 }],
        ['a score that is not a number', { symbol: undefined, score: Number.NaN, maxPoints: 10 }],
        ['a maximum of zero', { symbol: undefined, score: 0, maxPoints: 0 }],
        ['an empty title', { title: '   ' }],
        ['a title over 200 characters', { title: 'x'.repeat(201) }],
      ])('rejects %s and creates nothing', async (_label, overrides) => {
        const result = await create(overrides);

        expect(errorOf(result)).toBeInstanceOf(ValidationError);
        expect(count(db, 'sessions')).toBe(0);
        expect(count(db, 'assessments')).toBe(0);
        expect(count(db, 'plugin_assessments')).toBe(0);
      });

      it('accepts a title of exactly 200 characters', async () => {
        expect((await create({ title: 'x'.repeat(200) })).ok).toBe(true);
      });

      it('accepts a score of zero', async () => {
        expect((await create({ symbol: undefined, score: 0, maxPoints: 10 })).ok).toBe(true);
      });
    });

    it('removes the assessment again when remembering it fails', async () => {
      const failing: PluginAssessmentRepository = {
        record: () => Promise.reject(new Error('disk full')),
        isCreatedBy: () => Promise.resolve(false),
        remove: () => Promise.resolve(),
      };
      host = build({ pluginAssessments: failing });

      await expect(create()).rejects.toThrow('disk full');

      expect(count(db, 'assessments')).toBe(0);
      expect(count(db, 'student_performances')).toBe(0);
    });
  });

  describe('deleteImpromptu', () => {
    const createAs = async (caller: PluginCaller, studentId = 's-muster') => {
      const categoryId = caller.courseId === 'course-1' ? mitarbeitId : otherCourseMitarbeitId;
      return valueOf(await host.createImpromptu(caller, { studentId, categoryId, symbol: 'PLUS' }));
    };

    it('is denied without the assessment:impromptu permission', async () => {
      const created = await createAs(aCaller());

      const result = await host.deleteImpromptu(aCaller({ permissions: ['course:read'] }), created.assessmentId);

      expect(errorOf(result)).toBeInstanceOf(PluginPermissionDeniedError);
      expect(count(db, 'assessments')).toBe(1);
    });

    it('deletes an assessment the plugin created, with its performance', async () => {
      const created = await createAs(aCaller());

      const result = await host.deleteImpromptu(aCaller(), created.assessmentId);

      expect(result.ok).toBe(true);
      expect(count(db, 'assessments')).toBe(0);
      expect(count(db, 'student_performances')).toBe(0);
      expect(count(db, 'plugin_assessments')).toBe(0);
    });

    it('leaves the other assessments of the session alone', async () => {
      const first = await createAs(aCaller(), 's-muster');
      const second = await createAs(aCaller(), 's-zorn');

      await host.deleteImpromptu(aCaller(), first.assessmentId);

      const left = await assessmentService.listBySession(second.sessionId);
      expect(left.map((a) => a.id)).toEqual([second.assessmentId]);
    });

    it('refuses an assessment another plugin created', async () => {
      const created = await createAs(aCaller({ id: 'at.example.other' }));

      const result = await host.deleteImpromptu(aCaller({ id: 'at.example.tool' }), created.assessmentId);

      expect(errorOf(result)).toBeInstanceOf(PluginPermissionDeniedError);
      expect(count(db, 'assessments')).toBe(1);
    });

    it('refuses an assessment the teacher created', async () => {
      const session = valueOf(await sessionService.findOrCreateOnDate('course-1', '2026-10-12'));
      const own = valueOf(
        await assessmentService.create({
          sessionId: session.id,
          title: 'Eigene',
          categoryId: mitarbeitId,
          courseId: 'course-1',
          isImpromptu: true,
        }),
      );

      const result = await host.deleteImpromptu(aCaller(), own.id);

      expect(errorOf(result)).toBeInstanceOf(PluginPermissionDeniedError);
      expect(count(db, 'assessments')).toBe(1);
    });

    it('refuses an assessment of another course even when the plugin created it there', async () => {
      const created = await createAs(aCaller({ courseId: 'course-2' }));

      const result = await host.deleteImpromptu(aCaller({ courseId: 'course-1' }), created.assessmentId);

      expect(errorOf(result)).toBeInstanceOf(NotInCourseError);
      expect(count(db, 'assessments')).toBe(1);
    });

    it('refuses an assessment that does not exist', async () => {
      const result = await host.deleteImpromptu(aCaller(), 'nope');

      expect(errorOf(result)).toBeInstanceOf(PluginPermissionDeniedError);
    });

    it('reports an assessment that was remembered but has vanished and forgets it', async () => {
      const removed: string[] = [];
      host = build({
        pluginAssessments: {
          record: () => Promise.resolve(),
          isCreatedBy: () => Promise.resolve(true),
          remove: (id) => {
            removed.push(id);
            return Promise.resolve();
          },
        },
        assessmentRepo: { findById: () => Promise.resolve(null) } as unknown as AssessmentRepository,
      });

      const result = await host.deleteImpromptu(aCaller(), 'a-gone');

      expect(errorOf(result)).toBeInstanceOf(NotFoundError);
      expect(removed).toEqual(['a-gone']);
    });
  });
});
