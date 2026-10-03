import { CourseRepository } from '../domain/grade/CourseRepository';
import { SessionRepository } from '../domain/grade/SessionRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { StudentId } from '../domain/student/StudentId';
import { Session } from '../domain/grade/Session';
import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';
import { GradingService } from './GradingService';

export interface RecordMitarbeitPickInput {
  courseId: string;
  studentId: string;
  symbol: string;
  /** Calendar day as YYYY-MM-DD. */
  date: string;
}

export interface MitarbeitPickDto {
  performanceId: string;
  sessionId: string;
  symbol: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Records a Mitarbeit (class participation) for a student that was just picked in the Schülerauswahl. */
export class MitarbeitPickService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly studentRepo: StudentRepository,
    private readonly gradingService: GradingService,
  ) {}

  async record(input: RecordMitarbeitPickInput): Promise<Result<MitarbeitPickDto>> {
    if (!DAY.test(input.date) || Number.isNaN(Date.parse(input.date))) {
      return Result.fail(new ValidationError('date must be a calendar day (YYYY-MM-DD)'));
    }
    const symbol = ParticipationSymbol.create(input.symbol);
    if (!symbol.ok) return Result.fail(symbol.error);

    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));
    const mitarbeit = course.getMitarbeitCategory();
    if (!mitarbeit) {
      return Result.fail(new ValidationError('Der Kurs hat keine Kategorie "Mitarbeit".'));
    }

    const studentId = StudentId.create(input.studentId);
    if (!studentId.ok) return Result.fail(studentId.error);
    const student = await this.studentRepo.findById(studentId.value);
    if (!student) return Result.fail(new NotFoundError('Student', input.studentId));

    const sessions = await this.sessionRepo.findByCourse(input.courseId);
    const session =
      sessions.find((s) => s.date.toISOString().slice(0, 10) === input.date) ??
      Session.create(generateId(), new Date(input.date), '', course);
    session.addStudent(student);
    await this.sessionRepo.save(session);

    const assessments = session.assessments.filter((a) => a.category.id === mitarbeit.id);
    const assessment = assessments.find((a) => a.title === 'Mündlich') ?? assessments[0];
    if (!assessment) {
      return Result.fail(new ValidationError('Die Sitzung hat keine Mitarbeits-Beurteilung.'));
    }

    const performance = await this.gradingService.recordPerformance({
      studentId: input.studentId,
      assessmentId: assessment.id,
      symbol: symbol.value.value,
    });
    if (!performance.ok) return Result.fail(performance.error);

    return Result.ok({
      performanceId: performance.value.id,
      sessionId: session.id,
      symbol: performance.value.symbol ?? input.symbol,
    });
  }
}
