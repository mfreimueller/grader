import { GradeRepository } from '../domain/grade/GradeRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentPerformanceRepository } from '../domain/grade/StudentPerformanceRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { AssessmentRepository } from '../domain/grade/AssessmentRepository';
import { StudentId } from '../domain/student/StudentId';
import { Grade } from '../domain/grade/Grade';
import { GradedPerformance } from '../domain/grade/GradedPerformance';
import { GradedAssessment } from '../domain/grade/GradedAssessment';
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
  date?: string;
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
  ) {}

  async recordPerformance(input: RecordPerformanceInput): Promise<Result<PerformanceDto>> {
    const sidResult = StudentId.create(input.studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const student = await this.studentRepo.findById(sidResult.value);
    if (!student) return Result.fail(new NotFoundError('Student', input.studentId));

    const assessment = await this.assessmentRepo.findById(input.assessmentId);
    if (!assessment) return Result.fail(new NotFoundError('Assessment', input.assessmentId));

    const date = input.date ? new Date(input.date) : new Date();

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
        id, date, student, assessment, input.score,
      );
      if (!perfResult.ok) return Result.fail(perfResult.error);
      await this.perfRepo.savePerformance(perfResult.value);
      console.log('[GRADE]', `Saved graded performance: id=${perfResult.value.id}, score=${input.score}/${assessment.maxPoints}`);
      return Result.ok(toPerfDto(perfResult.value));
    }

    const symbolResult = ParticipationSymbol.create(input.symbol ?? 'WELLE');
    if (!symbolResult.ok) return Result.fail(symbolResult.error);

    const perfResult = ParticipationPerformance.create(
      id, date, student, assessment, symbolResult.value,
    );
    if (!perfResult.ok) return Result.fail(perfResult.error);
    await this.perfRepo.savePerformance(perfResult.value);
    console.log('[GRADE]', `Saved participation performance: id=${perfResult.value.id}, symbol=${symbolResult.value}`);
    return Result.ok(toPerfDto(perfResult.value));
  }

  async getPerformancesByAssessment(assessmentId: string): Promise<PerformanceDto[]> {
    const performances = await this.perfRepo.findPerformancesByAssessment(assessmentId);
    return performances.map(toPerfDto);
  }

  async getPerformancesByStudent(studentId: string): Promise<Result<PerformanceDto[]>> {
    const sidResult = StudentId.create(studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const performances = await this.perfRepo.findPerformancesByStudent(sidResult.value);
    return Result.ok(performances.map(toPerfDto));
  }

  async saveManualGrade(input: SaveGradeInput): Promise<Result<GradeDto>> {
    const sidResult = StudentId.create(input.studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const student = await this.studentRepo.findById(sidResult.value);
    if (!student) return Result.fail(new NotFoundError('Student', input.studentId));

    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));

    console.log(
      '[GRADE]',
      `Manual grade: student=${student.name.firstName} ${student.name.lastName}, course=${course.title}, score=${input.score}`,
    );

    const gradeResult = Grade.create(generateId(), student, course, input.score);
    if (!gradeResult.ok) return Result.fail(gradeResult.error);

    await this.gradeRepo.save(gradeResult.value);
    console.log('[GRADE]', `Saved manual grade: id=${gradeResult.value.id}, score=${input.score}`);
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
}

function toPerfDto(p: GradedPerformance | ParticipationPerformance): PerformanceDto {
  return {
    id: p.id,
    date: p.date.toISOString(),
    studentId: p.student.id.value,
    assessmentId: p.assessment.id,
    score: p instanceof GradedPerformance ? p.score : null,
    symbol: p instanceof ParticipationPerformance ? p.symbol.value : null,
    type: p instanceof GradedPerformance ? 'graded' : 'participation',
  };
}
