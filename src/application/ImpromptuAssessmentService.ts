import { AssessmentService } from './AssessmentService';
import { GradingService, RecordPerformanceInput } from './GradingService';
import { Result } from '../domain/shared/Result';

export interface ImpromptuResultDto {
  assessmentId: string;
  performance: {
    id: string;
    type: string;
    score: number | null;
    symbol: string | null;
  };
}

export interface CreateImpromptuInput {
  courseId: string;
  studentId: string;
  date: string;
  categoryId: string;
  title?: string;
  score?: number;
  symbol?: string;
  maxPoints?: number;
}

export class ImpromptuAssessmentService {
  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly gradingService: GradingService,
  ) {}

  async create(input: CreateImpromptuInput): Promise<Result<ImpromptuResultDto>> {
    const assessed = input.maxPoints !== undefined
      ? await this.assessmentService.create({
          title: input.title ?? `Impromptu ${new Date(input.date).toLocaleDateString()}`,
          date: input.date,
          categoryId: input.categoryId,
          courseId: input.courseId,
          isImpromptu: true,
          maxPoints: input.maxPoints,
        })
      : await this.assessmentService.create({
          title: input.title ?? `Impromptu ${new Date(input.date).toLocaleDateString()}`,
          date: input.date,
          categoryId: input.categoryId,
          courseId: input.courseId,
          isImpromptu: true,
        });

    if (!assessed.ok) return Result.fail(assessed.error);

    const perfInput: RecordPerformanceInput = {
      studentId: input.studentId,
      assessmentId: assessed.value.id,
      date: input.date,
    };

    if (input.score !== undefined) {
      perfInput.score = input.score;
    }
    if (input.symbol !== undefined) {
      perfInput.symbol = input.symbol;
    }

    const perfResult = await this.gradingService.recordPerformance(perfInput);
    if (!perfResult.ok) return Result.fail(perfResult.error);

    return Result.ok({
      assessmentId: assessed.value.id,
      performance: {
        id: perfResult.value.id,
        type: perfResult.value.type,
        score: perfResult.value.score,
        symbol: perfResult.value.symbol,
      },
    });
  }
}
