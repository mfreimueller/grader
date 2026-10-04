import { AssessmentRepository } from '../domain/grade/AssessmentRepository';
import { SessionRepository } from '../domain/grade/SessionRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { Assessment } from '../domain/grade/Assessment';
import { GradedAssessment } from '../domain/grade/GradedAssessment';
import { Session } from '../domain/grade/Session';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface AssessmentCategoryRefDto {
  id: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
}

export interface AssessmentDto {
  id: string;
  title: string;
  date: string;
  category: AssessmentCategoryRefDto;
  courseId: string;
  isImpromptu: boolean;
  maxPoints: number | null;
}

export interface CreateAssessmentInput {
  sessionId: string;
  title: string;
  categoryId: string;
  courseId: string;
  isImpromptu: boolean;
  maxPoints?: number;
}

export class AssessmentService {
  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  async listBySession(sessionId: string): Promise<AssessmentDto[]> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return [];

    const assessments = await this.assessmentRepo.findBySession(sessionId);
    return assessments.map(a => toDto(a, session.date));
  }

  async create(input: CreateAssessmentInput): Promise<Result<AssessmentDto>> {
    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));

    const category = course.assessmentCategories.find(c => c.id === input.categoryId);
    if (!category) return Result.fail(new NotFoundError('AssessmentCategory', input.categoryId));

    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) return Result.fail(new NotFoundError('Session', input.sessionId));

    let assessment: Assessment | GradedAssessment;

    if (input.maxPoints !== undefined && input.maxPoints > 0) {
      const result = GradedAssessment.create(
        generateId(),
        input.title,
        category,
        course,
        input.sessionId,
        input.maxPoints,
        input.isImpromptu,
      );
      if (!result.ok) return Result.fail(result.error);
      assessment = result.value;
    } else {
      assessment = new Assessment(
        generateId(),
        input.title,
        category,
        course,
        input.sessionId,
        input.isImpromptu,
      );
    }

    const reconstituted = Session.reconstitute(
      session.id,
      session.date,
      session.notes,
      session.course,
      [...session.students],
      [...session.assessments, assessment],
      session.absentStudentIds,
    );

    await this.sessionRepo.save(reconstituted);

    return Result.ok(toDto(assessment, session.date));
  }

  async delete(id: string): Promise<Result<void>> {
    const existing = await this.assessmentRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('Assessment', id));
    await this.assessmentRepo.delete(id);
    return Result.ok(undefined as void);
  }
}

function toDto(a: Assessment | GradedAssessment, sessionDate: Date): AssessmentDto {
  return {
    id: a.id,
    title: a.title,
    date: sessionDate.toISOString(),
    category: {
      id: a.category.id,
      title: a.category.title,
      gradingType: a.category.gradingType,
      displayAsGrade: a.category.displayAsGrade,
    },
    courseId: a.course.id,
    isImpromptu: a.isImpromptu,
    maxPoints: a instanceof GradedAssessment ? a.maxPoints : null,
  };
}
