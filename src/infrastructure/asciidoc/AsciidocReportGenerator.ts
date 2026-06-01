import type { CourseReportData } from '../../domain/report/CourseReportData';
import type { ReportGenerator } from '../../domain/report/ReportGenerator';

const GRADE_WRITTEN: Record<number, string> = {
  1: 'Sehr Gut',
  2: 'Gut',
  3: 'Befriedigend',
  4: 'Genügend',
  5: 'Nicht Genügend',
};

function gradeToWritten(grade: number): string {
  return GRADE_WRITTEN[grade] ?? String(grade);
}

export class AsciidocReportGenerator implements ReportGenerator {
  async generate(data: CourseReportData, _mode: 'full' | 'reduced'): Promise<Buffer> {
    const parts: string[] = [];

    for (let i = 0; i < data.students.length; i++) {
      const s = data.students[i]!;
      if (i > 0) parts.push('<<<');

      const grade = s.manualGrade ?? s.calculatedGrade;

      parts.push(`= ${s.firstName} ${s.lastName}`);
      parts.push('');
      parts.push(`== Aufzeichnungen: ${data.courseTitle} — ${data.className} — ${data.schoolYearLabel}`);
      parts.push('');

      parts.push('=== Gesamtnote');
      parts.push('');
      if (grade !== null) {
        parts.push(`${gradeToWritten(grade)} (${grade})`);
      } else {
        parts.push('-');
      }
      parts.push('');

      if (s.categoryGrades.length > 0) {
        parts.push('=== Bestandteile der Note');
        parts.push('');

        for (const cg of s.categoryGrades) {
          parts.push(`==== ${cg.categoryTitle}`);
          parts.push('');
          parts.push(`${gradeToWritten(cg.displayGrade)} (${cg.displayGrade})`);
          parts.push('');
        }
      }

      parts.push('');
    }

    const content = parts.join('\n');
    return Buffer.from(content, 'utf-8');
  }
}
