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
        className: '3A',
        schoolYearLabel: '2025/26',
        students: [],
      };
      expect(data.courseId).toBe('c-001');
      expect(data.courseTitle).toBe('Mathematik');
      expect(data.className).toBe('3A');
      expect(data.schoolYearLabel).toBe('2025/26');
      expect(data.students).toEqual([]);
    });
  });

  describe('StudentReportEntry', () => {
    it('holds student info with optional manual grade and performances', () => {
      const entry: StudentReportEntry = {
        studentId: 's-001',
        firstName: 'Max',
        lastName: 'Mustermann',
        manualGrade: 2,
        calculatedGrade: 2,
        categoryGrades: [],
        performances: [],
      };
      expect(entry.studentId).toBe('s-001');
      expect(entry.firstName).toBe('Max');
      expect(entry.lastName).toBe('Mustermann');
      expect(entry.manualGrade).toBe(2);
      expect(entry.calculatedGrade).toBe(2);
    });

    it('allows null manualGrade when no grade is recorded', () => {
      const entry: StudentReportEntry = {
        studentId: 's-001',
        firstName: 'Max',
        lastName: 'Mustermann',
        manualGrade: null,
        calculatedGrade: null,
        categoryGrades: [],
        performances: [],
      };
      expect(entry.manualGrade).toBeNull();
    });
  });
});

describe('sortStudentsByLastName', () => {
  it('sorts students alphabetically by lastName then firstName', () => {
    const students: StudentReportEntry[] = [
      { studentId: 's-001', firstName: 'Anna', lastName: 'Muster', manualGrade: null, calculatedGrade: null, categoryGrades: [], performances: [] },
      { studentId: 's-002', firstName: 'Max', lastName: 'Muster', manualGrade: null, calculatedGrade: null, categoryGrades: [], performances: [] },
      { studentId: 's-003', firstName: 'Bernd', lastName: 'Acker', manualGrade: null, calculatedGrade: null, categoryGrades: [], performances: [] },
    ];
    const sorted = sortStudentsByLastName(students);
    expect(sorted[0]?.lastName).toBe('Acker');
    expect(sorted[1]?.lastName).toBe('Muster');
    expect(sorted[1]?.firstName).toBe('Anna');
    expect(sorted[2]?.firstName).toBe('Max');
  });

  it('does not mutate the original array', () => {
    const students: StudentReportEntry[] = [
      { studentId: 's-001', firstName: 'Max', lastName: 'B', manualGrade: null, calculatedGrade: null, categoryGrades: [], performances: [] },
      { studentId: 's-002', firstName: 'Anna', lastName: 'A', manualGrade: null, calculatedGrade: null, categoryGrades: [], performances: [] },
    ];
    const original = [...students];
    sortStudentsByLastName(students);
    expect(students).toEqual(original);
  });
});
