import { ReportRepository } from '../domain/report/ReportRepository';
import type { ReportGenerator } from '../domain/report/ReportGenerator';
import { PdfReportGenerator } from '../infrastructure/pdf/PdfReportGenerator';
import { AsciidocReportGenerator } from '../infrastructure/asciidoc/AsciidocReportGenerator';
import { GradeCalculationAppService } from './GradeCalculationAppService';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';

export class ReportService {
  private readonly generators: Record<string, ReportGenerator>;

  constructor(
    private readonly reportRepo: ReportRepository,
    pdfGenerator: PdfReportGenerator,
    adocGenerator: AsciidocReportGenerator,
    private readonly gradeCalc: GradeCalculationAppService,
  ) {
    this.generators = {
      pdf: pdfGenerator,
      adoc: adocGenerator,
    };
  }

  async generate(courseId: string, mode: 'full' | 'reduced'): Promise<Result<Buffer>> {
    return this.generateReport(courseId, mode, 'pdf');
  }

  async generateSingle(
    courseId: string,
    studentId: string,
    mode: 'full' | 'reduced',
    format: 'pdf' | 'adoc',
  ): Promise<Result<Buffer>> {
    const data = await this.reportRepo.findCourseReportData(courseId);
    if (!data) return Result.fail(new NotFoundError('Course', courseId));

    const student = data.students.find(s => s.studentId === studentId);
    if (!student) return Result.fail(new NotFoundError('Student', studentId));

    const gradeResult = await this.gradeCalc.calculate(courseId, studentId);
    const enrichedStudent = gradeResult.ok
      ? {
          ...student,
          calculatedGrade: gradeResult.value.displayGrade,
          categoryGrades: gradeResult.value.categoryGrades.map(cg => ({
            categoryTitle: cg.categoryTitle,
            displayGrade: cg.displayGrade,
            mean: cg.mean,
          })),
        }
      : student;

    const enrichedData = { ...data, students: [enrichedStudent] };
    const generator = this.generators[format];
    if (!generator) return Result.fail(new NotFoundError('Generator', format));

    const buf = await generator.generate(enrichedData, mode);
    return Result.ok(buf);
  }

  private async generateReport(
    courseId: string,
    mode: 'full' | 'reduced',
    format: 'pdf' | 'adoc',
  ): Promise<Result<Buffer>> {
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
    const generator = this.generators[format];
    if (!generator) return Result.fail(new NotFoundError('Generator', format));

    const buf = await generator.generate(enrichedData, mode);
    return Result.ok(buf);
  }
}
