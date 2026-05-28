import { ReportRepository } from '../../domain/report/ReportRepository';

export class DataExportService {
  constructor(private readonly reportRepo: ReportRepository) {}

  async exportCourseReportCsv(courseId: string): Promise<string> {
    const data = await this.reportRepo.findCourseReportData(courseId);
    if (!data) {
      throw new Error(`Course ${courseId} not found`);
    }

    const rows: string[] = [];

    rows.push('Nachname;Vorname;Note;Leistungen');

    for (const student of data.students) {
      const perfStrings = student.performances.map(p => {
        const display = p.symbol
          ? `${p.assessmentTitle} (${p.categoryTitle}): ${p.symbol}`
          : p.rawScore !== null && p.maxPoints !== null
            ? `${p.assessmentTitle} (${p.categoryTitle}): ${p.rawScore}/${p.maxPoints}`
            : `${p.assessmentTitle} (${p.categoryTitle}): -`;
        return display;
      });

      const cells: string[] = [
        student.lastName,
        student.firstName,
        student.manualGrade !== null ? String(student.manualGrade) : '',
        perfStrings.join(' | '),
      ];

      rows.push(cells.join(';'));
    }

    return rows.join('\n') + '\n';
  }
}
