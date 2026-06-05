import { GradeRepository } from '../domain/grade/GradeRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentPerformanceRepository } from '../domain/grade/StudentPerformanceRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { AssessmentRepository } from '../domain/grade/AssessmentRepository';
import { SessionRepository } from '../domain/grade/SessionRepository';
import { StudentId } from '../domain/student/StudentId';
import { Grade } from '../domain/grade/Grade';
import { GradedPerformance } from '../domain/grade/GradedPerformance';
import { GradedAssessment } from '../domain/grade/GradedAssessment';
import { StudentPerformance } from '../domain/grade/StudentPerformance';
import { ParticipationPerformance } from '../domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface PerformanceDto {
  id: string;
  date: string;
  studentId: string;
  assessmentId: string;
  score: number | null;
  symbol: string | null;
  type: string;
}

export interface GradeDto {
  id: string;
  studentId: string;
  courseId: string;
  score: number;
}

export interface RecordPerformanceInput {
  studentId: string;
  assessmentId: string;
  score?: number;
  symbol?: string;
}

export interface SaveGradeInput {
  studentId: string;
  courseId: string;
  score: number;
}

export class GradingService {
  constructor(
    private readonly gradeRepo: GradeRepository,
    private readonly courseRepo: CourseRepository,
    private readonly perfRepo: StudentPerformanceRepository,
    private readonly studentRepo: StudentRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly sessionRepo: SessionRepository,
  ) {}

  async recordPerformance(input: RecordPerformanceInput): Promise<Result<PerformanceDto>> {
    const sidResult = StudentId.create(input.studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const student = await this.studentRepo.findById(sidResult.value);
    if (!student) return Result.fail(new NotFoundError('Student', input.studentId));

    const assessment = await this.assessmentRepo.findById(input.assessmentId);
    if (!assessment) return Result.fail(new NotFoundError('Assessment', input.assessmentId));

    const existing = (await this.perfRepo.findPerformancesByAssessment(input.assessmentId))
      .find(p => p.student.id.value === input.studentId);
    const id = existing?.id ?? generateId();

    console.log(
      '[GRADE]',
      `Record: student=${student.name.firstName} ${student.name.lastName}, assessment=${assessment.title}, ` +
        `category=${assessment.category.title}, existing=${existing ? 'yes' : 'no'}, ` +
        `score=${input.score ?? '?'}, symbol=${input.symbol ?? '?'}`,
    );

    if (assessment instanceof GradedAssessment) {
      if (input.score === undefined) {
        return Result.fail(new ValidationError('Graded assessments require a score'));
      }
      const perfResult = GradedPerformance.create(
        id, student, assessment, input.score,
      );
      if (!perfResult.ok) return Result.fail(perfResult.error);
      await this.perfRepo.savePerformance(perfResult.value);
      console.log('[GRADE]', `Saved graded performance: id=${perfResult.value.id}, score=${input.score}/${assessment.maxPoints}`);
      return Result.ok(await this.toPerfDto(perfResult.value));
    }

    const symbolResult = ParticipationSymbol.create(input.symbol ?? 'WELLE');
    if (!symbolResult.ok) return Result.fail(symbolResult.error);

    const perfResult = ParticipationPerformance.create(
      id, student, assessment, symbolResult.value,
    );
    if (!perfResult.ok) return Result.fail(perfResult.error);
    await this.perfRepo.savePerformance(perfResult.value);
    console.log('[GRADE]', `Saved participation performance: id=${perfResult.value.id}, symbol=${symbolResult.value}`);
    return Result.ok(await this.toPerfDto(perfResult.value));
  }

  async deletePerformance(performanceId: string): Promise<Result<void>> {
    await this.perfRepo.deletePerformance(performanceId);
    return Result.ok(undefined);
  }

  async getPerformancesByAssessment(assessmentId: string): Promise<PerformanceDto[]> {
    const performances = await this.perfRepo.findPerformancesByAssessment(assessmentId);
    return this.toPerfDtos(performances);
  }

  async getPerformancesByStudent(studentId: string): Promise<Result<PerformanceDto[]>> {
    const sidResult = StudentId.create(studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const performances = await this.perfRepo.findPerformancesByStudent(sidResult.value);
    return Result.ok(await this.toPerfDtos(performances));
  }

  async saveManualGrade(input: SaveGradeInput): Promise<Result<GradeDto>> {
    const sidResult = StudentId.create(input.studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const student = await this.studentRepo.findById(sidResult.value);
    if (!student) return Result.fail(new NotFoundError('Student', input.studentId));

    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));

    const existing = await this.gradeRepo.findByCourseAndStudent(course.id, student.id);
    const id = existing?.id ?? generateId();

    const gradeResult = Grade.create(id, student, course, input.score);
    if (!gradeResult.ok) return Result.fail(gradeResult.error);

    await this.gradeRepo.save(gradeResult.value);
    return Result.ok({
      id: gradeResult.value.id,
      studentId: input.studentId,
      courseId: input.courseId,
      score: input.score,
    });
  }

  async getGrade(studentId: string, courseId: string): Promise<Result<GradeDto | null>> {
    const sidResult = StudentId.create(studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const grade = await this.gradeRepo.findByCourseAndStudent(courseId, sidResult.value);
    if (!grade) return Result.ok(null);

    return Result.ok({
      id: grade.id,
      studentId: grade.student.id.value,
      courseId: grade.course.id,
      score: grade.score,
    });
  }

  async listGradesByStudent(studentId: string): Promise<Result<GradeDto[]>> {
    const sidResult = StudentId.create(studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const grades = await this.gradeRepo.findByStudent(sidResult.value);
    return Result.ok(grades.map(g => ({
      id: g.id,
      studentId: g.student.id.value,
      courseId: g.course.id,
      score: g.score,
    })));
  }

  private async loadSessionDate(assessmentId: string): Promise<Date> {
    const assessment = await this.assessmentRepo.findById(assessmentId);
    if (!assessment) return new Date();
    const session = await this.sessionRepo.findById(assessment.sessionId);
    if (!session) return new Date();
    return session.date;
  }

  private async toPerfDto(p: GradedPerformance | ParticipationPerformance): Promise<PerformanceDto> {
    const sessionDate = await this.loadSessionDate(p.assessment.id);
    return {
      id: p.id,
      date: sessionDate.toISOString(),
      studentId: p.student.id.value,
      assessmentId: p.assessment.id,
      score: p instanceof GradedPerformance ? p.score : null,
      symbol: p instanceof ParticipationPerformance ? p.symbol.value : null,
      type: p instanceof GradedPerformance ? 'graded' : 'participation',
    };
  }

  private async toPerfDtos(performances: StudentPerformance[]): Promise<PerformanceDto[]> {
    const sessionCache = new Map<string, Date>();
    const result: PerformanceDto[] = [];

    for (const p of performances) {
      const sessionId = p.assessment.sessionId;
      let sessionDate = sessionCache.get(sessionId);
      if (!sessionDate) {
        const session = await this.sessionRepo.findById(sessionId);
        sessionDate = session?.date ?? new Date();
        sessionCache.set(sessionId, sessionDate);
      }

      result.push({
        id: p.id,
        date: sessionDate.toISOString(),
        studentId: p.student.id.value,
        assessmentId: p.assessment.id,
        score: p instanceof GradedPerformance ? p.score : null,
        symbol: p instanceof ParticipationPerformance ? p.symbol.value : null,
        type: p instanceof GradedPerformance ? 'graded' : 'participation',
      });
    }

    return result;
  }
}
