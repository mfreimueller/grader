import { ReportRepository } from '../domain/report/ReportRepository';
import { PdfReportGenerator } from '../infrastructure/pdf/PdfReportGenerator';
import { DataExportService } from '../infrastructure/fs/DataExportService';
import { GradeCalculationAppService } from './GradeCalculationAppService';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';

export class ReportService {
  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly pdfGenerator: PdfReportGenerator,
    private readonly dataExport: DataExportService,
    private readonly gradeCalc: GradeCalculationAppService,
  ) {}

  async generate(courseId: string, mode: 'full' | 'reduced'): Promise<Result<Buffer | string>> {
    const data = await this.reportRepo.findCourseReportData(courseId);
    if (!data) return Result.fail(new NotFoundError('Course', courseId));

    if (mode === 'reduced') {
      const csv = await this.dataExport.exportCourseReportCsv(courseId);
      return Result.ok(csv);
    }

    const pdf = await this.pdfGenerator.generateCourseReport(courseId);
    return Result.ok(pdf);
  }
}
