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

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

      if (s.performances.length > 0) {
        parts.push('==== Leistungsnachweise');
        parts.push('');
        parts.push('|===');
        parts.push('| Datum | Bezeichnung | Kategorie | Ergebnis | Max | Anmerkungen');

        for (const p of s.performances) {
          const dateStr = formatDate(p.date);
          const result = p.symbol ?? (p.rawScore !== null ? String(p.rawScore) : '-');
          const maxStr = p.maxPoints !== null ? String(p.maxPoints) : (p.symbol ? '' : '-');
          const notes = p.notes.length > 0 ? p.notes.join('; ') : '';
          parts.push(`| ${dateStr} | ${p.assessmentTitle} | ${p.categoryTitle} | ${result} | ${maxStr} | ${notes}`);
        }

        parts.push('|===');
        parts.push('');
      }

      parts.push('');
    }

    const content = parts.join('\n');
    return Buffer.from(content, 'utf-8');
  }
}
