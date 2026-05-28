import { CourseReportData } from './CourseReportData';

export interface ReportRepository {
  findCourseReportData(courseId: string): Promise<CourseReportData | null>;
}
