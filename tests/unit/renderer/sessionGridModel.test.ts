import { buildSessionGrid, resultCount } from '../../../src/renderer/utils/sessionGridModel';
import type { AssessmentDto, PerformanceDto, SessionNoteDto, StudentDto } from '../../../src/shared/types';

const aStudent = (id: string, firstName = 'Max', lastName = 'Muster'): StudentDto => ({
  id,
  firstName,
  lastName,
  schoolClass: { id: 'class-1', name: '1A', schoolYear: '2025/26' },
  additionalInfo: [],
  color: null,
});

const anAssessment = (o: Partial<AssessmentDto> & { id: string; numeric?: boolean }): AssessmentDto => {
  const numeric = o.numeric ?? o.maxPoints != null;
  return {
    id: o.id,
    title: o.title ?? o.id,
    date: '2025-10-01',
    category: {
      id: numeric ? 'cat-num' : 'cat-ter',
      title: numeric ? 'Schularbeit' : 'Mitarbeit',
      gradingType: numeric ? 'NUMERIC' : 'TERTIARY',
      displayAsGrade: false,
      isHidden: false,
    },
    courseId: 'course-1',
    isImpromptu: o.isImpromptu ?? false,
    maxPoints: o.maxPoints ?? (numeric ? 30 : null),
  };
};

const aPerformance = (studentId: string, assessmentId: string, o: Partial<PerformanceDto> = {}): PerformanceDto => ({
  id: o.id ?? `p-${studentId}-${assessmentId}`,
  date: '2025-10-01',
  studentId,
  assessmentId,
  score: o.score ?? null,
  symbol: o.symbol ?? null,
  type: o.symbol !== undefined && o.symbol !== null ? 'participation' : 'graded',
});

const build = (o: {
  students?: StudentDto[];
  assessments?: AssessmentDto[];
  performances?: PerformanceDto[];
  notes?: SessionNoteDto[];
  absent?: string[];
  studentNotes?: { studentId: string; text: string }[];
  asc?: boolean;
}) =>
  buildSessionGrid({
    students: o.students ?? [aStudent('s-1')],
    assessments: o.assessments ?? [],
    performances: o.performances ?? [],
    notes: o.notes ?? [],
    absentStudentIds: o.absent ?? [],
    studentNotes: o.studentNotes ?? [],
    sortAscending: o.asc ?? true,
  });

describe('buildSessionGrid', () => {
  describe('columns', () => {
    it('has one column per shared assessment in the given order', () => {
      const grid = build({
        assessments: [anAssessment({ id: 'a-1', title: 'Mündlich' }), anAssessment({ id: 'a-2', title: 'Test', maxPoints: 20 })],
      });
      expect(grid.columns.map((c) => c.assessmentId)).toEqual(['a-1', 'a-2']);
    });

    it('describes a column with title, category, grading type and max points', () => {
      const grid = build({ assessments: [anAssessment({ id: 'a-1', title: 'Schularbeit 1', maxPoints: 30 })] });
      expect(grid.columns[0]).toEqual({
        assessmentId: 'a-1',
        title: 'Schularbeit 1',
        categoryTitle: 'Schularbeit',
        gradingType: 'NUMERIC',
        maxPoints: 30,
      });
    });

    it('describes a tertiary column without max points', () => {
      const grid = build({ assessments: [anAssessment({ id: 'a-1', title: 'Mündlich', numeric: false })] });
      expect(grid.columns[0]).toMatchObject({ gradingType: 'TERTIARY', maxPoints: null });
    });

    it('leaves impromptu assessments out of the columns', () => {
      const grid = build({ assessments: [anAssessment({ id: 'a-1', isImpromptu: true })] });
      expect(grid.columns).toEqual([]);
    });
  });

  describe('rows', () => {
    it('shows "Nachname, Vorname" and the student id', () => {
      const grid = build({ students: [aStudent('s-1', 'Anna', 'Gruber')] });
      expect(grid.rows[0]!.studentId).toBe('s-1');
      expect(grid.rows[0]!.displayName).toBe('Gruber, Anna');
    });

    it('sorts by last name, then first name, with German collation', () => {
      const grid = build({
        students: [aStudent('1', 'Zoe', 'Zeller'), aStudent('2', 'Eva', 'Ärger'), aStudent('3', 'Bert', 'Bauer'), aStudent('4', 'Anna', 'Bauer')],
      });
      expect(grid.rows.map((r) => r.displayName)).toEqual(['Ärger, Eva', 'Bauer, Anna', 'Bauer, Bert', 'Zeller, Zoe']);
    });

    it('reverses the order when sorting descending', () => {
      const grid = build({ students: [aStudent('1', 'A', 'Alt'), aStudent('2', 'B', 'Bauer')], asc: false });
      expect(grid.rows.map((r) => r.studentId)).toEqual(['2', '1']);
    });

    it('gives every row one shared cell per column, aligned with the columns', () => {
      const grid = build({
        students: [aStudent('s-1'), aStudent('s-2', 'Anna', 'Nobody')],
        assessments: [anAssessment({ id: 'a-1' }), anAssessment({ id: 'a-2', maxPoints: 10 })],
      });
      for (const row of grid.rows) {
        expect(row.sharedCells.map((c) => c.assessmentId)).toEqual(['a-1', 'a-2']);
      }
    });

    it('has no rows without students', () => {
      expect(build({ students: [] }).rows).toEqual([]);
    });

    it('ignores performances of students who are not in the list', () => {
      const grid = build({
        students: [aStudent('s-1')],
        assessments: [anAssessment({ id: 'a-1', numeric: false })],
        performances: [aPerformance('gone', 'a-1', { symbol: 'PLUS' })],
      });
      expect(grid.rows).toHaveLength(1);
      expect(grid.rows[0]!.sharedCells[0]!.kind).toBe('empty');
    });
  });

  describe('cells', () => {
    const cellOf = (assessment: AssessmentDto, performance?: PerformanceDto, notes: SessionNoteDto[] = []) =>
      build({ assessments: [assessment], performances: performance ? [performance] : [], notes }).rows[0]!.sharedCells[0]!;

    it('is empty without a performance', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', numeric: false }));
      expect(cell).toMatchObject({
        key: 's-1:a-1',
        studentId: 's-1',
        assessmentId: 'a-1',
        performanceId: null,
        kind: 'empty',
        symbol: null,
        points: null,
        isImpromptu: false,
        canHaveNote: false,
        hasNote: false,
        noteText: null,
        locked: false,
      });
    });

    it('shows the symbol of a tertiary performance', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', numeric: false }), aPerformance('s-1', 'a-1', { symbol: 'WELLE' }));
      expect(cell).toMatchObject({ kind: 'symbol', symbol: 'WELLE', points: null, performanceId: 'p-s-1-a-1' });
    });

    it('treats an unknown symbol as empty but keeps the performance', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', numeric: false }), aPerformance('s-1', 'a-1', { symbol: 'BOGUS' }));
      expect(cell.kind).toBe('empty');
      expect(cell.symbol).toBeNull();
      expect(cell.performanceId).not.toBeNull();
    });

    it('shows the points of a numeric performance together with the max points', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', maxPoints: 30 }), aPerformance('s-1', 'a-1', { score: 24 }));
      expect(cell).toMatchObject({ kind: 'points', points: 24, maxPoints: 30, symbol: null });
    });

    it('shows zero points as points, not as empty', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', maxPoints: 30 }), aPerformance('s-1', 'a-1', { score: 0 }));
      expect(cell).toMatchObject({ kind: 'points', points: 0 });
    });

    it('is empty for a numeric performance that is not yet graded', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', maxPoints: 30 }), aPerformance('s-1', 'a-1'));
      expect(cell.kind).toBe('empty');
      expect(cell.performanceId).not.toBeNull();
      expect(cell.canHaveNote).toBe(false);
    });

    it('decides by the grading type of the assessment, not by what the performance holds', () => {
      const numeric = cellOf(anAssessment({ id: 'a-1', maxPoints: 30 }), aPerformance('s-1', 'a-1', { symbol: 'PLUS' }));
      expect(numeric.kind).toBe('empty');
      const tertiary = cellOf(anAssessment({ id: 'a-1', numeric: false }), aPerformance('s-1', 'a-1', { score: 5 }));
      expect(tertiary.kind).toBe('empty');
    });

    it('can have a note once it is graded', () => {
      expect(cellOf(anAssessment({ id: 'a-1', numeric: false }), aPerformance('s-1', 'a-1', { symbol: 'PLUS' })).canHaveNote).toBe(true);
      expect(cellOf(anAssessment({ id: 'a-1', maxPoints: 30 }), aPerformance('s-1', 'a-1', { score: 0 })).canHaveNote).toBe(true);
    });

    it('carries the note text of its performance', () => {
      const cell = cellOf(
        anAssessment({ id: 'a-1', numeric: false }),
        aPerformance('s-1', 'a-1', { symbol: 'PLUS', id: 'p-9' }),
        [{ performanceId: 'p-9', text: 'Meldet sich oft' }],
      );
      expect(cell).toMatchObject({ hasNote: true, noteText: 'Meldet sich oft' });
    });

    it('does not mix up notes of other performances', () => {
      const cell = cellOf(
        anAssessment({ id: 'a-1', numeric: false }),
        aPerformance('s-1', 'a-1', { symbol: 'PLUS', id: 'p-9' }),
        [{ performanceId: 'p-other', text: 'Anderer' }],
      );
      expect(cell.hasNote).toBe(false);
      expect(cell.noteText).toBeNull();
    });

    it('still shows a note on a cell that is no longer graded', () => {
      const cell = cellOf(anAssessment({ id: 'a-1', maxPoints: 30 }), aPerformance('s-1', 'a-1', { id: 'p-9' }), [
        { performanceId: 'p-9', text: 'Alt' },
      ]);
      expect(cell).toMatchObject({ kind: 'empty', hasNote: true, canHaveNote: false });
    });
  });

  describe('impromptu cells', () => {
    it('shows an impromptu assessment only in the row of the student who has a performance on it', () => {
      const grid = build({
        students: [aStudent('s-1', 'Anna', 'Alt'), aStudent('s-2', 'Bert', 'Bauer')],
        assessments: [anAssessment({ id: 'i-1', isImpromptu: true, numeric: false })],
        performances: [aPerformance('s-2', 'i-1', { symbol: 'PLUS' })],
      });
      expect(grid.rows[0]!.impromptuCells).toEqual([]);
      expect(grid.rows[1]!.impromptuCells.map((c) => c.assessmentId)).toEqual(['i-1']);
    });

    it('marks them as impromptu and fills them like shared cells', () => {
      const grid = build({
        assessments: [anAssessment({ id: 'i-1', isImpromptu: true, maxPoints: 20 })],
        performances: [aPerformance('s-1', 'i-1', { score: 17 })],
      });
      expect(grid.rows[0]!.impromptuCells[0]).toMatchObject({ isImpromptu: true, kind: 'points', points: 17, maxPoints: 20 });
    });

    it('keeps the order in which the assessments were given', () => {
      const grid = build({
        assessments: [
          anAssessment({ id: 'i-2', isImpromptu: true, numeric: false }),
          anAssessment({ id: 'a-1', numeric: false }),
          anAssessment({ id: 'i-1', isImpromptu: true, numeric: false }),
        ],
        performances: [aPerformance('s-1', 'i-1', { symbol: 'PLUS' }), aPerformance('s-1', 'i-2', { symbol: 'MINUS' })],
      });
      expect(grid.rows[0]!.impromptuCells.map((c) => c.assessmentId)).toEqual(['i-2', 'i-1']);
    });

    it('hides an impromptu assessment nobody has a performance on', () => {
      const grid = build({ assessments: [anAssessment({ id: 'i-1', isImpromptu: true })] });
      expect(grid.rows[0]!.impromptuCells).toEqual([]);
    });
  });

  describe('student notes', () => {
    it('has no note by default', () => {
      expect(build({}).rows[0]!.studentNote).toBeNull();
    });

    it('attaches the general note to the row of its student', () => {
      const grid = build({
        students: [aStudent('s-1', 'Anna', 'Berger'), aStudent('s-2', 'Max', 'Muster')],
        studentNotes: [{ studentId: 's-2', text: 'beteiligt sich nicht' }],
      });
      expect(grid.rows.map((r) => r.studentNote)).toEqual([null, 'beteiligt sich nicht']);
    });

    it('keeps the note of an absent student and does not touch the cells', () => {
      const grid = build({
        assessments: [anAssessment({ id: 'a-1' })],
        absent: ['s-1'],
        studentNotes: [{ studentId: 's-1', text: 'krank' }],
      });
      expect(grid.rows[0]!.studentNote).toBe('krank');
      expect(grid.rows[0]!.sharedCells[0]!.hasNote).toBe(false);
    });
  });

  describe('absence', () => {
    const base = {
      students: [aStudent('s-1', 'Anna', 'Alt'), aStudent('s-2', 'Bert', 'Bauer')],
      assessments: [anAssessment({ id: 'a-1', numeric: false }), anAssessment({ id: 'i-1', isImpromptu: true, numeric: false })],
      performances: [aPerformance('s-1', 'a-1', { symbol: 'PLUS' }), aPerformance('s-1', 'i-1', { symbol: 'MINUS' })],
    };

    it('locks every cell of an absent student and keeps their values', () => {
      const row = build({ ...base, absent: ['s-1'] }).rows[0]!;
      expect(row.absent).toBe(true);
      expect(row.sharedCells.every((c) => c.locked)).toBe(true);
      expect(row.impromptuCells.every((c) => c.locked)).toBe(true);
      expect(row.sharedCells[0]!.symbol).toBe('PLUS');
    });

    it('leaves present students unlocked', () => {
      const row = build({ ...base, absent: ['s-1'] }).rows[1]!;
      expect(row.absent).toBe(false);
      expect(row.sharedCells.every((c) => !c.locked)).toBe(true);
    });

    it('ignores absent ids of students who are not in the list', () => {
      const grid = build({ ...base, absent: ['gone'] });
      expect(grid.rows.every((r) => !r.absent)).toBe(true);
    });
  });
});

describe('resultCount', () => {
  it('counts the students of the grid who have a performance on the assessment, graded or not', () => {
    const grid = build({
      students: [aStudent('s-1', 'A', 'Alt'), aStudent('s-2', 'B', 'Bauer'), aStudent('s-3', 'C', 'Cäsar')],
      assessments: [anAssessment({ id: 'a-1', maxPoints: 30 }), anAssessment({ id: 'a-2', maxPoints: 30 })],
      performances: [
        aPerformance('s-1', 'a-1', { score: 20 }),
        aPerformance('s-2', 'a-1'),
        aPerformance('s-1', 'a-2', { score: 5 }),
        aPerformance('gone', 'a-1', { score: 9 }),
      ],
    });
    expect(resultCount(grid, 'a-1')).toBe(2);
    expect(resultCount(grid, 'a-2')).toBe(1);
  });

  it('is zero for an unknown assessment', () => {
    expect(resultCount(build({}), 'missing')).toBe(0);
  });
});
