import PDFDocument from 'pdfkit';
import { ReportRepository } from '../../domain/report/ReportRepository';

export class PdfReportGenerator {
  constructor(private readonly reportRepo: ReportRepository) {}

  async generateCourseReport(courseId: string): Promise<Buffer> {
    const data = await this.reportRepo.findCourseReportData(courseId);
    if (!data) {
      throw new Error(`Course ${courseId} not found`);
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, data.courseTitle, data.schoolYearLabel);

      for (const student of data.students) {
        this.renderStudent(doc, student);
      }

      doc.end();
    });
  }

  private renderHeader(
    doc: typeof PDFDocument.prototype,
    courseTitle: string,
    schoolYearLabel: string,
  ): void {
    doc.fontSize(18).text('Zeugnis', { align: 'center' });
    doc.fontSize(14).text(`${courseTitle} (${schoolYearLabel})`, { align: 'center' });
    doc.moveDown(1.5);
  }

  private renderStudent(
    doc: typeof PDFDocument.prototype,
    student: {
      firstName: string;
      lastName: string;
      manualGrade: number | null;
      performances: Array<{
        assessmentTitle: string;
        date: Date;
        categoryTitle: string;
        rawScore: number | null;
        maxPoints: number | null;
        symbol: string | null;
      }>;
    },
  ): void {
    const gradeDisplay = student.manualGrade !== null
      ? `Note: ${student.manualGrade}`
      : 'Keine Note';

    doc.fontSize(12).text(`${student.lastName}, ${student.firstName} — ${gradeDisplay}`, {
      underline: true,
    });

    for (const perf of student.performances) {
      const displayValue = perf.symbol
        ? perf.symbol
        : perf.rawScore !== null && perf.maxPoints !== null
          ? `${perf.rawScore}/${perf.maxPoints}`
          : '-';

      doc.fontSize(10).text(
        `  ${perf.assessmentTitle} (${perf.categoryTitle}): ${displayValue}`,
        { indent: 10 },
      );
    }

    doc.moveDown(0.5);
  }
}
