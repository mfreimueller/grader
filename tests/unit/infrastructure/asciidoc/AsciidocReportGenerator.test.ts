import { AsciidocReportGenerator } from '../../../../src/infrastructure/asciidoc/AsciidocReportGenerator';
import type { CourseReportData } from '../../../../src/domain/report/CourseReportData';

describe('AsciidocReportGenerator', () => {
  const generator = new AsciidocReportGenerator();

  const baseData: CourseReportData = {
    courseId: 'course-1',
    courseTitle: 'Mathematik',
    className: '1A',
    schoolYearLabel: '2025/26',
    students: [
      {
        studentId: 's-001',
        firstName: 'Max',
        lastName: 'Mustermann',
        manualGrade: null,
        calculatedGrade: 2,
        categoryGrades: [],
        performances: [],
      },
      {
        studentId: 's-002',
        firstName: 'Anna',
        lastName: 'Muster',
        manualGrade: null,
        calculatedGrade: null,
        categoryGrades: [],
        performances: [],
      },
    ],
  };

  it('generates an AsciiDoc table with header', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('= Notenübersicht: Mathematik — 1A — 2025/26');
    expect(content).toContain('|===');
    expect(content).toContain('| Name | Note');
  });

  it('includes student names and grades', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('| Mustermann, Max | 2');
    expect(content).toContain('| Muster, Anna | -');
  });

  it('prefers manualGrade over calculatedGrade', async () => {
    const data: CourseReportData = {
      ...baseData,
      students: [
        {
          ...baseData.students[0]!,
          manualGrade: 3,
          calculatedGrade: 1,
        },
      ],
    };
    const buf = await generator.generate(data, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('| Mustermann, Max | 3');
  });

  it('handles empty student list', async () => {
    const data: CourseReportData = { ...baseData, students: [] };
    const buf = await generator.generate(data, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('|===');
  });
});
