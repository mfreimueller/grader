import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentPerformanceRepository } from '../domain/grade/StudentPerformanceRepository';
import { GradeCalculationService } from '../domain/grade/GradeCalculationService';
import { StudentId } from '../domain/student/StudentId';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';

export interface GradeCalculationResultDto {
  rawScore: number;
  displayGrade: 1 | 2 | 3 | 4 | 5;
  categoryGrades: Array<{
    categoryId: string;
    categoryTitle: string;
    weight: number;
    mean: number;
    performanceCount: number;
    displayGrade: 1 | 2 | 3 | 4 | 5;
  }>;
}

export class GradeCalculationAppService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly perfRepo: StudentPerformanceRepository,
    private readonly calculationService: GradeCalculationService,
  ) {}

  async calculate(courseId: string, studentId: string): Promise<Result<GradeCalculationResultDto>> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));

    const sidResult = StudentId.create(studentId);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const performances = await this.perfRepo.findPerformancesByStudent(sidResult.value);

    console.log(
      '[GRADE]',
      `Calculate: course=${course.title} (${courseId}), student=${studentId}, ` +
        `totalPerformances=${performances.length}`,
    );

    const coursePerformances = performances.filter(
      p => p.assessment.course.id === courseId,
    );

    console.log(
      '[GRADE]',
      `Filtered: coursePerformances=${coursePerformances.length} (removed ${performances.length - coursePerformances.length} from other courses)`,
    );

    const result = this.calculationService.calculate(
      coursePerformances,
      course,
    );

    if (!result.ok) {
      console.log('[GRADE]', `Calculation failed: ${result.error.message}`);
      return Result.fail(result.error);
    }
    console.log('[GRADE]', `Calculation success: rawScore=${result.value.rawScore}, displayGrade=${result.value.displayGrade}`);
    return Result.ok(result.value);
  }
}
