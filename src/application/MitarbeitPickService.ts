import { CourseRepository } from '../domain/grade/CourseRepository';
import { SessionRepository } from '../domain/grade/SessionRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { StudentId } from '../domain/student/StudentId';
import { Session } from '../domain/grade/Session';
import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { GradingType } from '../domain/grade/GradingType';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';
import { ImpromptuAssessmentService } from './ImpromptuAssessmentService';
import { CourseRosterService } from './CourseRosterService';

export interface RecordMitarbeitPickInput {
  courseId: string;
  studentId: string;
  symbol: string;
  /** Calendar day as YYYY-MM-DD. */
  date: string;
  /** Tertiary category of the impromptu assessment; defaults to Mitarbeit. */
  categoryId?: string | undefined;
}

export interface MitarbeitPickDto {
  assessmentId: string;
  performanceId: string;
  sessionId: string;
  symbol: string;
}

const IMPROMPTU_TITLE = 'Schülerauswahl';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Grades a student that was just picked in the Schülerauswahl with an impromptu assessment (Mitarbeit by default). */
export class MitarbeitPickService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly studentRepo: StudentRepository,
    private readonly impromptuService: ImpromptuAssessmentService,
    private readonly rosterService: CourseRosterService,
  ) {}

  async record(input: RecordMitarbeitPickInput): Promise<Result<MitarbeitPickDto>> {
    if (!DAY.test(input.date) || Number.isNaN(Date.parse(input.date))) {
      return Result.fail(new ValidationError('date must be a calendar day (YYYY-MM-DD)'));
    }
    const symbol = ParticipationSymbol.create(input.symbol);
    if (!symbol.ok) return Result.fail(symbol.error);

    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));
    const category = input.categoryId
      ? course.assessmentCategories.find((c) => c.id === input.categoryId)
      : course.getMitarbeitCategory();
    if (!category) {
      return Result.fail(
        input.categoryId
          ? new NotFoundError('AssessmentCategory', input.categoryId)
          : new ValidationError('Der Kurs hat keine Kategorie "Mitarbeit".'),
      );
    }
    if (category.gradingType !== GradingType.TERTIARY) {
      return Result.fail(new ValidationError('Die Kategorie muss mit +, ~ und − beurteilt werden.'));
    }

    const studentId = StudentId.create(input.studentId);
    if (!studentId.ok) return Result.fail(studentId.error);
    const student = await this.studentRepo.findById(studentId.value);
    if (!student) return Result.fail(new NotFoundError('Student', input.studentId));
    const roster = await this.rosterService.rosterOfCourse(course);
    if (!roster.some((s) => s.id.value === input.studentId)) {
      return Result.fail(new ValidationError('Der Schüler gehört nicht zu diesem Kurs.'));
    }

    const sessions = await this.sessionRepo.findByCourse(input.courseId);
    const session =
      sessions.find((s) => s.date.toISOString().slice(0, 10) === input.date) ??
      Session.create(generateId(), new Date(input.date), '', course);
    session.addStudent(student);
    await this.sessionRepo.save(session);

    const impromptu = await this.impromptuService.create({
      courseId: input.courseId,
      studentId: input.studentId,
      categoryId: category.id,
      sessionId: session.id,
      title: IMPROMPTU_TITLE,
      symbol: symbol.value.value,
    });
    if (!impromptu.ok) return Result.fail(impromptu.error);

    return Result.ok({
      assessmentId: impromptu.value.assessmentId,
      performanceId: impromptu.value.performance.id,
      sessionId: session.id,
      symbol: impromptu.value.performance.symbol ?? input.symbol,
    });
  }
}
