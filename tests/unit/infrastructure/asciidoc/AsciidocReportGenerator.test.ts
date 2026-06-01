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
        categoryGrades: [
          { categoryTitle: 'Schularbeit', displayGrade: 2, mean: 0.85 },
          { categoryTitle: 'Mitarbeit', displayGrade: 1, mean: 0.95 },
        ],
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

  it('generates a per-student report with title and metadata', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('= Max Mustermann');
    expect(content).toContain('== Aufzeichnungen: Mathematik — 1A — 2025/26');
    expect(content).toContain('=== Gesamtnote');
  });

  it('uses written form for grades', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('Gut (2)');
  });

  it('includes category breakdown under Bestandteile der Note', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('=== Bestandteile der Note');
    expect(content).toContain('==== Schularbeit');
    expect(content).toContain('==== Mitarbeit');
    expect(content).toContain('Gut (2)');
    expect(content).toContain('Sehr Gut (1)');
  });

  it('prefers manualGrade over calculatedGrade', async () => {
    const data: CourseReportData = {
      ...baseData,
      students: [
        {
          ...baseData.students[0]!,
          manualGrade: 3,
          calculatedGrade: 1,
          categoryGrades: [],
        },
      ],
    };
    const buf = await generator.generate(data, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('Befriedigend (3)');
    expect(content).not.toContain('Sehr Gut (1)');
  });

  it('shows a dash for missing grade', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    const secondStudentSection = content.split('<<<')[1] ?? '';
    expect(secondStudentSection).toContain('=== Gesamtnote\n\n-');
  });

  it('separates multiple students with page break', async () => {
    const buf = await generator.generate(baseData, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('<<<');
    expect(content).toContain('= Max Mustermann');
    expect(content).toContain('= Anna Muster');
  });

  it('handles empty student list', async () => {
    const data: CourseReportData = { ...baseData, students: [] };
    const buf = await generator.generate(data, 'reduced');
    expect(buf.toString('utf-8').trim()).toBe('');
  });

  it('maps all grade values to correct written form', async () => {
    const grades = [1, 2, 3, 4, 5];
    for (const g of grades) {
      const data: CourseReportData = {
        ...baseData,
        students: [{
          ...baseData.students[0]!,
          manualGrade: null,
          calculatedGrade: g,
          categoryGrades: [],
        }],
      };
      const buf = await generator.generate(data, 'reduced');
      const content = buf.toString('utf-8');
      expect(content).toContain(`(${g})`);
    }
  });

  it('renders Leistungsnachweise section with performance table', async () => {
    const data: CourseReportData = {
      ...baseData,
      students: [{
        ...baseData.students[0]!,
        performances: [
          {
            assessmentTitle: 'Test 1',
            date: new Date('2025-10-01'),
            categoryTitle: 'Schularbeit',
            rawScore: 24,
            maxPoints: 30,
            symbol: null,
            notes: ['gut gemacht'],
          },
          {
            assessmentTitle: 'Mitarbeit Oktober',
            date: new Date('2025-10-15'),
            categoryTitle: 'Mitarbeit',
            rawScore: null,
            maxPoints: null,
            symbol: '+',
            notes: [],
          },
        ],
      }],
    };
    const buf = await generator.generate(data, 'reduced');
    const content = buf.toString('utf-8');
    expect(content).toContain('==== Leistungsnachweise');
    expect(content).toContain('|===');
    expect(content).toContain('| Datum | Bezeichnung | Kategorie | Ergebnis | Max | Anmerkungen');
    expect(content).toContain('| 2025-10-01 | Test 1 | Schularbeit | 24 | 30 | gut gemacht');
    expect(content).toContain('| 2025-10-15 | Mitarbeit Oktober | Mitarbeit | + |  |');
  });

  it('renders Leistungsnachweise only when performances exist', async () => {
    const content = (await generator.generate(baseData, 'reduced')).toString('utf-8');
    expect(content).not.toContain('==== Leistungsnachweise');
  });
});
