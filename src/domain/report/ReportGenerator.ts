import type { CourseReportData } from './CourseReportData';

export interface ReportGenerator {
  generate(data: CourseReportData, mode: 'full' | 'reduced'): Promise<Buffer>;
}
