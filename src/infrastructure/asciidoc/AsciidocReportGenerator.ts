import type { CourseReportData } from '../../domain/report/CourseReportData';
import type { ReportGenerator } from '../../domain/report/ReportGenerator';

export class AsciidocReportGenerator implements ReportGenerator {
  async generate(data: CourseReportData, mode: 'full' | 'reduced'): Promise<Buffer> {
    const lines: string[] = [];

    lines.push(`= Notenübersicht: ${data.courseTitle} — ${data.className} — ${data.schoolYearLabel}`);
    lines.push('');
    lines.push('|===');
    lines.push('| Name | Note');

    for (const student of data.students) {
      const grade = student.manualGrade ?? student.calculatedGrade;
      const displayGrade = grade !== null ? String(grade) : '-';
      const name = `${student.lastName}, ${student.firstName}`;
      lines.push(`| ${name} | ${displayGrade}`);
    }

    lines.push('|===');
    lines.push('');

    const content = lines.join('\n');
    return Buffer.from(content, 'utf-8');
  }
}
