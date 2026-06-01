import PDFDocument from 'pdfkit';
import type { CourseReportData, CategoryGradeReportEntry } from '../../domain/report/CourseReportData';
import type { ReportGenerator } from '../../domain/report/ReportGenerator';

interface Column {
  title: string;
  width: number;
  align: 'left' | 'center' | 'right';
  render: (student: StudentRow) => string;
}

interface StudentRow {
  name: string;
  displayGrade: string;
  categoryGrades: CategoryGradeReportEntry[];
}

export class PdfReportGenerator implements ReportGenerator {
  async generate(data: CourseReportData, mode: 'full' | 'reduced'): Promise<Buffer> {
    const isDetailed = mode === 'full';
    const doc = new PDFDocument({
      margin: 50,
      layout: isDetailed ? 'landscape' : 'portrait',
      size: 'A4',
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderTitle(doc, data);
      this.renderTable(doc, data, isDetailed);
      doc.end();
    });
  }

  private renderTitle(doc: typeof PDFDocument.prototype, data: CourseReportData): void {
    doc.fontSize(16).font('Helvetica-Bold')
      .text(`${data.courseTitle} - ${data.className} - ${data.schoolYearLabel}`, { align: 'center' });
    doc.fontSize(11).font('Helvetica')
      .text('Notenübersicht', { align: 'center' });
    doc.moveDown(1.2);
  }

  private renderTable(doc: typeof PDFDocument.prototype, data: CourseReportData, isDetailed: boolean): void {
    const leftMargin = 50;
    const pageWidth = doc.page.width - leftMargin * 2;
    const rows = this.buildRows(data);
    const columns = this.buildColumns(data, isDetailed, pageWidth);
    const colWidths = columns.map(c => c.width);
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    const rowHeight = 20;
    const headerHeight = 24;
    let y = doc.y;

    const fillCell = (x: number, w: number, rowY: number, h: number, color: string) => {
      doc.rect(x, rowY, w, h).fill(color);
    };

    const strokeGrid = (rowY: number, h: number) => {
      doc.lineWidth(0.5).strokeColor('#cccccc');
      let x = leftMargin;
      for (const cw of colWidths) {
        doc.moveTo(x, rowY).lineTo(x, rowY + h).stroke();
        x += cw;
      }
      doc.moveTo(leftMargin, rowY).lineTo(leftMargin + totalWidth, rowY).stroke();
      doc.moveTo(leftMargin + totalWidth, rowY).lineTo(leftMargin + totalWidth, rowY + h).stroke();
    };

    const strokeBottom = (rowY: number, h: number) => {
      doc.lineWidth(0.5).strokeColor('#cccccc')
        .moveTo(leftMargin, rowY + h).lineTo(leftMargin + totalWidth, rowY + h).stroke();
    };

    const drawText = (x: number, w: number, text: string, align: string, bold: boolean) => {
      doc.fillColor('#000000')
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .text(text, x + 4, y + (rowHeight - 9) / 2 + (bold ? 2 : 0), {
          width: w - 8,
          align: align as 'left' | 'center' | 'right',
          lineBreak: false,
        });
    };

    fillCell(leftMargin, totalWidth, y, headerHeight, '#e8e8e8');
    strokeGrid(y, headerHeight);
    let x = leftMargin;
    for (const col of columns) {
      drawText(x, col.width, col.title, col.align, true);
      x += col.width;
    }
    strokeBottom(y, headerHeight);
    y += headerHeight;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (y + rowHeight > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }

      if (i % 2 === 1) {
        fillCell(leftMargin, totalWidth, y, rowHeight, '#f5f5f5');
      }

      strokeGrid(y, rowHeight);
      x = leftMargin;
      for (const col of columns) {
        drawText(x, col.width, col.render(row), col.align, false);
        x += col.width;
      }
      strokeBottom(y, rowHeight);
      y += rowHeight;
    }
  }

  private buildRows(data: CourseReportData): StudentRow[] {
    return data.students.map(s => {
      const grade = s.manualGrade ?? s.calculatedGrade;
      return {
        name: `${s.lastName}, ${s.firstName}`,
        displayGrade: grade !== null ? String(grade) : '-',
        categoryGrades: s.categoryGrades,
      };
    });
  }

  private buildColumns(data: CourseReportData, isDetailed: boolean, pageWidth: number): Column[] {
    const nameWidth = 200;
    const gradeWidth = 50;

    const nameCol: Column = {
      title: 'Name',
      width: nameWidth,
      align: 'left',
      render: (r) => r.name,
    };

    const gradeCol: Column = {
      title: 'Note',
      width: gradeWidth,
      align: 'center',
      render: (r) => r.displayGrade,
    };

    if (!isDetailed) {
      nameCol.width = pageWidth - gradeWidth;
      return [nameCol, gradeCol];
    }

    const categoryTitles = this.getCategoryTitles(data);
    const remainingWidth = pageWidth - nameWidth - gradeWidth;
    const catWidth = categoryTitles.length > 0
      ? Math.max(70, Math.floor(remainingWidth / categoryTitles.length))
      : 0;

    const catCols: Column[] = categoryTitles.map(cat => ({
      title: cat,
      width: catWidth,
      align: 'center',
      render: (r) => {
        const cg = r.categoryGrades.find(c => c.categoryTitle === cat);
        if (!cg) return '-';
        const pct = (cg.mean * 100).toFixed(1).replace('.', ',');
        return `${cg.displayGrade} (${pct}%)`;
      },
    }));

    return [nameCol, gradeCol, ...catCols];
  }

  private getCategoryTitles(data: CourseReportData): string[] {
    const titles = new Set<string>();
    for (const s of data.students) {
      for (const cg of s.categoryGrades) {
        titles.add(cg.categoryTitle);
      }
    }
    return Array.from(titles);
  }
}
