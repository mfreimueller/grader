import { AssessmentService } from '../../../src/application/AssessmentService';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { SessionService } from '../../../src/application/SessionService';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { Course } from '../../../src/domain/grade/Course';
import { GradingType } from '../../../src/domain/grade/GradingType';
import type { SecretCipher } from '../../../src/domain/plugin/SecretCipher';
import { Name } from '../../../src/domain/student/Name';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import type { Db } from '../../../src/infrastructure/persistence/db';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { Result } from '../../../src/domain/shared/Result';
import type {
  JideApi,
  JideCourse,
  JideExercise,
  JideGrade,
  JideHandin,
  JideResult,
} from '../../../src/domain/jide/JideApi';

export const valueOf = <T>(result: Result<T, Error>): T => {
  if (!result.ok) throw result.error;
  return result.value;
};
export const errorOf = <T>(result: Result<T, Error>): Error => {
  if (result.ok) throw new Error('expected a failure');
  return result.error;
};

/** Not a real cipher: the "encrypted" bytes are the reversed text. */
export class FakeCipher implements SecretCipher {
  available = true;
  isAvailable(): boolean {
    return this.available;
  }
  encrypt(plain: string): Uint8Array {
    return Buffer.from([...plain].reverse().join(''), 'utf8');
  }
  decrypt(data: Uint8Array): string {
    return [...Buffer.from(data).toString('utf8')].reverse().join('');
  }
}

export interface JideFixture {
  db: Db;
  courseRepo: SqliteCourseRepository;
  rosterService: CourseRosterService;
  sessionService: SessionService;
  assessmentService: AssessmentService;
  sessionId: string;
  /** A symbol column ("Mitarbeit") and a points column of `course-1`. */
  tertiaryId: string;
  numericId: string;
}

/** Course `course-1` ("Programmieren", class 3AHIF) with Max Mustermann, Anna Bauer and Zoe Zorn. */
export async function createJideFixture(): Promise<JideFixture> {
  const db = createInMemoryDb();
  runMigrations(db);
  const classRepo = new SqliteSchoolClassRepository(db);
  const courseRepo = new SqliteCourseRepository(db);
  const studentRepo = new SqliteStudentRepository(db);
  const year = SchoolYear.create('2026/27');
  if (!year.ok) throw year.error;
  const schoolClass = new SchoolClass('class-1', '3AHIF', year.value);
  classRepo.save(schoolClass);
  const course = Course.create('course-1', 'Programmieren', schoolClass);
  course.addAssessmentCategory(new AssessmentCategory('cat-test', 'Test', GradingType.NUMERIC, true));
  courseRepo.save(course);
  for (const [id, first, last] of [
    ['s-max', 'Max', 'Mustermann'],
    ['s-anna', 'Anna', 'Bauer'],
    ['s-zoe', 'Zoe', 'Zorn'],
  ] as const) {
    const sid = StudentId.create(id);
    const name = Name.create(first, last);
    if (!sid.ok || !name.ok) throw new Error('fixture');
    studentRepo.save(Student.create(sid.value, name.value, schoolClass));
  }
  const sessionRepo = new SqliteSessionRepository(db);
  const rosterService = new CourseRosterService(courseRepo, studentRepo, new SqliteCourseRosterRepository(db));
  const sessionService = new SessionService(sessionRepo, courseRepo, studentRepo, rosterService);
  const assessmentService = new AssessmentService(new SqliteAssessmentRepository(db), sessionRepo, courseRepo);
  const sessionId = valueOf(await sessionService.create({ courseId: 'course-1', date: '2026-11-12' })).id;
  const mitarbeitId = course.getMitarbeitCategory()!.id;
  const make = async (title: string, categoryId: string, extra: object = {}): Promise<string> =>
    valueOf(
      await assessmentService.create({ sessionId, title, categoryId, courseId: 'course-1', isImpromptu: false, ...extra }),
    ).id;
  return {
    db,
    courseRepo,
    rosterService,
    sessionService,
    assessmentService,
    sessionId,
    tertiaryId: await make('Übung', mitarbeitId),
    numericId: await make('Test 1', 'cat-test', { maxPoints: 20 }),
  };
}

/** An in-memory J;DE: every call answers from the fields; `putGrade` is recorded. */
export class FakeJideApi implements JideApi {
  courses: JideResult<JideCourse[]> = Result.ok([
    {
      id: '7',
      subject: 'Programmieren',
      className: '3AHIF',
      students: [
        { id: '11', name: 'Max Mustermann' },
        { id: '12', name: 'Bauer Anna' },
        { id: '13', name: 'Eva Fremd' },
      ],
    },
    { id: '8', subject: 'Datenbanken', className: '4BHIF', students: [{ id: '21', name: 'Zoe Zorn' }] },
  ]);
  exercises: JideResult<JideExercise[]> = Result.ok([
    { id: '3', slug: 'summe', title: 'Summe', difficulty: null, unlockedAt: null, deadline: null },
  ]);
  packageZip: JideResult<Uint8Array> = Result.ok(new Uint8Array([1, 2, 3]));
  handins: JideResult<JideHandin[]> = Result.ok([]);
  put: (handinId: string, grade: JideGrade) => JideResult<{ gradedAt: string }> = () =>
    Result.ok({ gradedAt: '2026-11-20T10:00:00Z' });
  readonly puts: { handinId: string; grade: JideGrade }[] = [];
  readonly calls: string[] = [];

  async listCourses(): Promise<JideResult<JideCourse[]>> {
    this.calls.push('listCourses');
    return this.courses;
  }
  async listExercises(courseId: string): Promise<JideResult<JideExercise[]>> {
    this.calls.push(`listExercises ${courseId}`);
    return this.exercises;
  }
  async fetchPackage(exerciseId: string): Promise<JideResult<Uint8Array>> {
    this.calls.push(`fetchPackage ${exerciseId}`);
    return this.packageZip;
  }
  async listHandins(courseId: string, exerciseId: string): Promise<JideResult<JideHandin[]>> {
    this.calls.push(`listHandins ${courseId} ${exerciseId}`);
    return this.handins;
  }
  async putGrade(handinId: string, grade: JideGrade): Promise<JideResult<{ gradedAt: string }>> {
    this.puts.push({ handinId, grade });
    return this.put(handinId, grade);
  }
}
