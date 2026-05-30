import { ReportRepository } from '../domain/report/ReportRepository';
import { PdfReportGenerator } from '../infrastructure/pdf/PdfReportGenerator';
import { GradeCalculationAppService } from './GradeCalculationAppService';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';

export class ReportService {
  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly pdfGenerator: PdfReportGenerator,
    private readonly gradeCalc: GradeCalculationAppService,
  ) {}

  async generate(courseId: string, mode: 'full' | 'reduced'): Promise<Result<Buffer>> {
    const data = await this.reportRepo.findCourseReportData(courseId);
    if (!data) return Result.fail(new NotFoundError('Course', courseId));

    const enrichedStudents = await Promise.all(
      data.students.map(async (s) => {
        const gradeResult = await this.gradeCalc.calculate(courseId, s.studentId);
        if (gradeResult.ok) {
          return {
            ...s,
            calculatedGrade: gradeResult.value.displayGrade,
            categoryGrades: gradeResult.value.categoryGrades.map(cg => ({
              categoryTitle: cg.categoryTitle,
              displayGrade: cg.displayGrade,
              mean: cg.mean,
            })),
          };
        }
        return s;
      }),
    );

    const enrichedData = { ...data, students: enrichedStudents };
    const pdf = await this.pdfGenerator.generate(enrichedData, mode);
    return Result.ok(pdf);
  }
}
