// Pure model of the session grid, kept out of the Vue components so every rule can be unit-tested.
// Shared assessments become columns (one cell per student); an impromptu assessment belongs to exactly one
// student and becomes an extra cell at the end of that student's row.

import type { AssessmentDto, PerformanceDto, SessionNoteDto, SessionStudentNoteDto, StudentDto } from '../../shared/types';

export type GridSymbol = 'PLUS' | 'WELLE' | 'MINUS';
export type GridGradingType = 'NUMERIC' | 'TERTIARY';
export type GridCellKind = 'empty' | 'symbol' | 'points';

export interface GridColumn {
  assessmentId: string;
  title: string;
  categoryTitle: string;
  gradingType: GridGradingType;
  maxPoints: number | null;
}

export interface GridCell {
  key: string;
  studentId: string;
  assessmentId: string;
  /** Null until a result was recorded; a note can only hang on an existing performance. */
  performanceId: string | null;
  kind: GridCellKind;
  symbol: GridSymbol | null;
  points: number | null;
  maxPoints: number | null;
  gradingType: GridGradingType;
  title: string;
  categoryTitle: string;
  isImpromptu: boolean;
  /** True when a note may be added: the cell holds a result. */
  canHaveNote: boolean;
  hasNote: boolean;
  noteText: string | null;
  /** Absent students' cells show their values but cannot be edited. */
  locked: boolean;
}

export interface GridRow {
  studentId: string;
  displayName: string;
  absent: boolean;
  /** General note on the student for this session (not tied to an assessment), or null. */
  studentNote: string | null;
  sharedCells: GridCell[];
  impromptuCells: GridCell[];
}

export interface SessionGridModel {
  columns: GridColumn[];
  rows: GridRow[];
}

export interface BuildSessionGridInput {
  students: readonly StudentDto[];
  /** Assessments of the session in creation order; that order is kept for columns and impromptu cells. */
  assessments: readonly AssessmentDto[];
  performances: readonly PerformanceDto[];
  notes: readonly SessionNoteDto[];
  absentStudentIds: readonly string[];
  studentNotes: readonly SessionStudentNoteDto[];
  sortAscending: boolean;
}

const SYMBOLS: readonly string[] = ['PLUS', 'WELLE', 'MINUS'];

const gradingTypeOf = (a: AssessmentDto): GridGradingType => (a.category.gradingType === 'NUMERIC' ? 'NUMERIC' : 'TERTIARY');

export function buildSessionGrid(input: BuildSessionGridInput): SessionGridModel {
  const absent = new Set(input.absentStudentIds);
  const studentNoteOf = new Map(input.studentNotes.map((n) => [n.studentId, n.text]));
  const noteByPerformance = new Map(input.notes.map((n) => [n.performanceId, n.text]));
  const performanceOf = new Map(input.performances.map((p) => [`${p.studentId}:${p.assessmentId}`, p]));

  const shared = input.assessments.filter((a) => !a.isImpromptu);
  const impromptu = input.assessments.filter((a) => a.isImpromptu);

  const columns: GridColumn[] = shared.map((a) => ({
    assessmentId: a.id,
    title: a.title,
    categoryTitle: a.category.title,
    gradingType: gradingTypeOf(a),
    maxPoints: a.maxPoints,
  }));

  const cellFor = (student: StudentDto, a: AssessmentDto, performance: PerformanceDto | undefined): GridCell => {
    const gradingType = gradingTypeOf(a);
    const symbol = gradingType === 'TERTIARY' && performance?.symbol != null && SYMBOLS.includes(performance.symbol)
      ? (performance.symbol as GridSymbol)
      : null;
    const points = gradingType === 'NUMERIC' ? (performance?.score ?? null) : null;
    const kind: GridCellKind = symbol !== null ? 'symbol' : points !== null ? 'points' : 'empty';
    const noteText = performance ? (noteByPerformance.get(performance.id) ?? null) : null;
    return {
      key: `${student.id}:${a.id}`,
      studentId: student.id,
      assessmentId: a.id,
      performanceId: performance?.id ?? null,
      kind,
      symbol,
      points,
      maxPoints: a.maxPoints,
      gradingType,
      title: a.title,
      categoryTitle: a.category.title,
      isImpromptu: a.isImpromptu,
      canHaveNote: kind !== 'empty',
      hasNote: noteText !== null,
      noteText,
      locked: absent.has(student.id),
    };
  };

  const sorted = [...input.students].sort((a, b) => {
    const cmp = a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de');
    return input.sortAscending ? cmp : -cmp;
  });

  const rows: GridRow[] = sorted.map((student) => ({
    studentId: student.id,
    displayName: `${student.lastName}, ${student.firstName}`,
    absent: absent.has(student.id),
    studentNote: studentNoteOf.get(student.id) ?? null,
    sharedCells: shared.map((a) => cellFor(student, a, performanceOf.get(`${student.id}:${a.id}`))),
    impromptuCells: impromptu.flatMap((a) => {
      const performance = performanceOf.get(`${student.id}:${a.id}`);
      return performance ? [cellFor(student, a, performance)] : [];
    }),
  }));

  return { columns, rows };
}

/** How many students of the grid have a performance (graded or not) on the assessment — what deleting it removes. */
export function resultCount(model: SessionGridModel, assessmentId: string): number {
  return model.rows.filter((row) =>
    [...row.sharedCells, ...row.impromptuCells].some((c) => c.assessmentId === assessmentId && c.performanceId !== null),
  ).length;
}
