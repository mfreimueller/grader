import {
  CourseReportData,
  StudentReportEntry,
  sortStudentsByLastName,
} from '../../../../src/domain/report/CourseReportData';

describe('CourseReportData', () => {
  describe('structure', () => {
    it('holds course metadata and a student list', () => {
      const data: CourseReportData = {
        courseId: 'c-001',
        courseTitle: 'Mathematik',
        schoolYearLabel: '2025/26',
        students: [],
      };
      expect(data.courseId).toBe('c-001');
      expect(data.courseTitle).toBe('Mathematik');
      expect(data.schoolYearLabel).toBe('2025/26');
      expect(data.students).toEqual([]);
    });
  });

  describe('StudentReportEntry', () => {
    it('holds student info with optional manual grade and performances', () => {
      const entry: StudentReportEntry = {
        firstName: 'Max',
        lastName: 'Mustermann',
        manualGrade: 2,
        performances: [],
      };
      expect(entry.firstName).toBe('Max');
      expect(entry.lastName).toBe('Mustermann');
      expect(entry.manualGrade).toBe(2);
    });

    it('allows null manualGrade when no grade is recorded', () => {
      const entry: StudentReportEntry = {
        firstName: 'Max',
        lastName: 'Mustermann',
        manualGrade: null,
        performances: [],
      };
      expect(entry.manualGrade).toBeNull();
    });
  });
});

describe('sortStudentsByLastName', () => {
  it('sorts students alphabetically by lastName then firstName', () => {
    const students: StudentReportEntry[] = [
      { firstName: 'Anna', lastName: 'Muster', manualGrade: null, performances: [] },
      { firstName: 'Max', lastName: 'Muster', manualGrade: null, performances: [] },
      { firstName: 'Bernd', lastName: 'Acker', manualGrade: null, performances: [] },
    ];
    const sorted = sortStudentsByLastName(students);
    expect(sorted[0]?.lastName).toBe('Acker');
    expect(sorted[1]?.lastName).toBe('Muster');
    expect(sorted[1]?.firstName).toBe('Anna');
    expect(sorted[2]?.firstName).toBe('Max');
  });

  it('does not mutate the original array', () => {
    const students: StudentReportEntry[] = [
      { firstName: 'Max', lastName: 'B', manualGrade: null, performances: [] },
      { firstName: 'Anna', lastName: 'A', manualGrade: null, performances: [] },
    ];
    const original = [...students];
    sortStudentsByLastName(students);
    expect(students).toEqual(original);
  });
});
