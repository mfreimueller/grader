// Pure model of the session grid, kept out of the Vue components so every rule can be unit-tested.
// Shared assessments become columns (one cell per student); an impromptu assessment belongs to exactly one
// student and becomes an extra cell at the end of that student's row. Impromptu assessments of the Mitarbeit
// category get their own zone between the two, closed by a draft cell that records the next Mitarbeit.

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
  /** Part of the Mitarbeit zone: a recorded Mitarbeit or the draft. */
  isMitarbeit: boolean;
  /** The draft of the Mitarbeit zone: not saved yet, a symbol entered here creates a new Mitarbeit. */
  isDraft: boolean;
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
  mitarbeitCells: GridCell[];
  mitarbeitDraft: GridCell;
  impromptuCells: GridCell[];
}

export interface SessionGridModel {
  columns: GridColumn[];
  rows: GridRow[];
  /** Cells the Mitarbeit zone spans: the longest row's results plus the draft, so the impromptu zone lines up. */
  mitarbeitWidth: number;
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
export const MITARBEIT_TITLE = 'Mitarbeit';

const gradingTypeOf = (a: AssessmentDto): GridGradingType => (a.category.gradingType === 'NUMERIC' ? 'NUMERIC' : 'TERTIARY');
const isMitarbeit = (a: AssessmentDto): boolean => a.isImpromptu && a.category.title === MITARBEIT_TITLE;

export function buildSessionGrid(input: BuildSessionGridInput): SessionGridModel {
  const absent = new Set(input.absentStudentIds);
  const studentNoteOf = new Map(input.studentNotes.map((n) => [n.studentId, n.text]));
  const noteByPerformance = new Map(input.notes.map((n) => [n.performanceId, n.text]));
  const performanceOf = new Map(input.performances.map((p) => [`${p.studentId}:${p.assessmentId}`, p]));

  const shared = input.assessments.filter((a) => !a.isImpromptu);
  const mitarbeit = input.assessments.filter(isMitarbeit);
  const impromptu = input.assessments.filter((a) => a.isImpromptu && !isMitarbeit(a));

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
      isMitarbeit: isMitarbeit(a),
      isDraft: false,
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

  const draftFor = (student: StudentDto): GridCell => ({
    key: `${student.id}:mitarbeit-draft`,
    studentId: student.id,
    assessmentId: '',
    performanceId: null,
    kind: 'empty',
    symbol: null,
    points: null,
    maxPoints: null,
    gradingType: 'TERTIARY',
    title: MITARBEIT_TITLE,
    categoryTitle: MITARBEIT_TITLE,
    isImpromptu: false,
    isMitarbeit: true,
    isDraft: true,
    canHaveNote: false,
    hasNote: false,
    noteText: null,
    locked: absent.has(student.id),
  });

  /** Cells of the student's own assessments: only those the student has a performance on. */
  const ownCells = (student: StudentDto, list: readonly AssessmentDto[]): GridCell[] =>
    list.flatMap((a) => {
      const performance = performanceOf.get(`${student.id}:${a.id}`);
      return performance ? [cellFor(student, a, performance)] : [];
    });

  const rows: GridRow[] = sorted.map((student) => ({
    studentId: student.id,
    displayName: `${student.lastName}, ${student.firstName}`,
    absent: absent.has(student.id),
    studentNote: studentNoteOf.get(student.id) ?? null,
    sharedCells: shared.map((a) => cellFor(student, a, performanceOf.get(`${student.id}:${a.id}`))),
    mitarbeitCells: ownCells(student, mitarbeit),
    mitarbeitDraft: draftFor(student),
    impromptuCells: ownCells(student, impromptu),
  }));

  const mitarbeitWidth = Math.max(0, ...rows.map((r) => r.mitarbeitCells.length)) + 1;
  return { columns, rows, mitarbeitWidth };
}

/** How many students of the grid have a performance (graded or not) on the assessment — what deleting it removes. */
export function resultCount(model: SessionGridModel, assessmentId: string): number {
  return model.rows.filter((row) =>
    [...row.sharedCells, ...row.mitarbeitCells, ...row.impromptuCells].some((c) => c.assessmentId === assessmentId && c.performanceId !== null),
  ).length;
}
