// Controller of the session grid: loads everything the grid shows, turns user actions into IPC calls and
// keeps the data fresh. The grid components only render the model and forward events (AGENTS §11).

import { computed, onBeforeUnmount, ref } from 'vue';
import type {
  AssessmentCategoryDto,
  AssessmentDto,
  PerformanceDto,
  ResultDto,
  SessionDto,
  SessionNoteDto,
  SessionStudentNoteDto,
  StudentDto,
} from '../../shared/types';
import { buildSessionGrid, type GridCell, type GridSymbol } from '../utils/sessionGridModel';
import { PendingDeletes } from '../utils/pendingDelete';

/** What the popover for a new shared assessment collects. */
export interface NewAssessmentInput {
  title: string;
  categoryId: string;
  maxPoints?: number;
}

export interface PendingImpromptu {
  assessmentId: string;
  title: string;
}

export function useSessionGrid(courseId: string, sessionId: string) {
  const students = ref<StudentDto[]>([]);
  const assessments = ref<AssessmentDto[]>([]);
  const performances = ref<PerformanceDto[]>([]);
  const notes = ref<SessionNoteDto[]>([]);
  const categories = ref<AssessmentCategoryDto[]>([]);
  const absentIds = ref<string[]>([]);
  const studentNotes = ref<SessionStudentNoteDto[]>([]);
  const sortAscending = ref(true);
  const loading = ref(true);
  const errorMessage = ref('');

  const pendingIds = ref<string[]>([]);
  const pendingTitles = new Map<string, string>();

  const model = computed(() =>
    buildSessionGrid({
      students: students.value,
      assessments: assessments.value.filter((a) => !pendingIds.value.includes(a.id)),
      performances: performances.value,
      notes: notes.value,
      absentStudentIds: absentIds.value,
      studentNotes: studentNotes.value,
      sortAscending: sortAscending.value,
    }),
  );

  const studentOf = (studentId: string): StudentDto | null => students.value.find((s) => s.id === studentId) ?? null;

  /** The delete the undo toast refers to: the most recent one that is still waiting. */
  const pendingCount = computed(() => pendingIds.value.length);

  const pendingDelete = computed<PendingImpromptu | null>(() => {
    const id = pendingIds.value[pendingIds.value.length - 1];
    return id === undefined ? null : { assessmentId: id, title: pendingTitles.get(id) ?? '' };
  });

  const pending = new PendingDeletes<PendingImpromptu>({
    commit: async (item) => {
      const result = await window.grdr.assessment.delete(item.assessmentId);
      if (!result.ok) throw new Error(result.error.message);
      await loadAssessments();
    },
    onChange: (ids) => {
      pendingIds.value = [...ids];
    },
    onError: (_item, error) => {
      errorMessage.value = error instanceof Error ? error.message : 'Die Leistung konnte nicht gelöscht werden.';
    },
  });

  /** Runs an IPC call that returns a result; reports its error and tells whether it worked. */
  async function attempt<T>(call: () => Promise<ResultDto<T>>): Promise<boolean> {
    const result = await call();
    if (result.ok) return true;
    errorMessage.value = result.error.message;
    return false;
  }

  async function loadPerformances(list: readonly AssessmentDto[]): Promise<void> {
    const perAssessment = await Promise.all(list.map((a) => window.grdr.grade.getPerformancesByAssessment(a.id)));
    performances.value = perAssessment.flat();
  }

  async function loadNotes(): Promise<void> {
    notes.value = await window.grdr.finding.listNotesBySession(sessionId);
  }

  async function loadAssessments(): Promise<void> {
    assessments.value = await window.grdr.assessment.listBySession(sessionId);
    await Promise.all([loadPerformances(assessments.value), loadNotes()]);
  }

  async function refreshAssessment(assessmentId: string): Promise<void> {
    const fresh = await window.grdr.grade.getPerformancesByAssessment(assessmentId);
    performances.value = [...performances.value.filter((p) => p.assessmentId !== assessmentId), ...fresh];
    await loadNotes();
  }

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const [members, cats, sessions] = await Promise.all([
        window.grdr.roster.members(courseId),
        window.grdr.assessmentCategory.listByCourse(courseId),
        window.grdr.session.listByCourse(courseId),
      ]);
      students.value = members.ok ? members.value : [];
      categories.value = cats;
      const session = sessions.find((s: SessionDto) => s.id === sessionId);
      absentIds.value = session?.absentStudentIds ?? [];
      studentNotes.value = session?.studentNotes ?? [];
      await loadAssessments();
    } finally {
      loading.value = false;
    }
  }

  async function setSymbol(cell: GridCell, symbol: GridSymbol): Promise<void> {
    const ok = await attempt(() => window.grdr.grade.recordPerformance({ studentId: cell.studentId, assessmentId: cell.assessmentId, symbol }));
    if (ok) await refreshAssessment(cell.assessmentId);
  }

  async function setPoints(cell: GridCell, score: number): Promise<void> {
    const ok = await attempt(() => window.grdr.grade.recordPerformance({ studentId: cell.studentId, assessmentId: cell.assessmentId, score }));
    if (ok) await refreshAssessment(cell.assessmentId);
  }

  /** Removes the student's result (and with it the note); the assessment stays for everybody else. */
  async function clearResult(cell: GridCell): Promise<void> {
    if (cell.performanceId === null) return;
    const performanceId = cell.performanceId;
    const ok = await attempt(() => window.grdr.grade.deletePerformance(performanceId));
    if (ok) await refreshAssessment(cell.assessmentId);
  }

  async function setNote(cell: GridCell, text: string): Promise<void> {
    if (cell.performanceId === null) return;
    const performanceId = cell.performanceId;
    const ok = await attempt(() => window.grdr.finding.setNote({ performanceId, text }));
    if (ok) await loadNotes();
  }

  async function createShared(input: NewAssessmentInput): Promise<boolean> {
    const ok = await attempt(() => window.grdr.assessment.create({ ...input, sessionId, courseId }));
    if (ok) await loadAssessments();
    return ok;
  }

  async function deleteShared(assessmentId: string): Promise<void> {
    const ok = await attempt(() => window.grdr.assessment.delete(assessmentId));
    if (ok) await loadAssessments();
  }

  function scheduleImpromptuDelete(cell: GridCell): void {
    pendingTitles.set(cell.assessmentId, cell.title);
    pending.schedule(cell.assessmentId, { assessmentId: cell.assessmentId, title: cell.title });
  }

  function undoDelete(assessmentId: string): void {
    pending.undo(assessmentId);
  }

  async function setAbsence(studentId: string, absent: boolean): Promise<void> {
    const result = await window.grdr.session.setAbsence(sessionId, { studentId, absent });
    if (result.ok) absentIds.value = result.value.absentStudentIds;
    else errorMessage.value = result.error.message;
  }

  /** Sets the general note of a student for this session; blank text removes it. */
  async function setStudentNote(studentId: string, text: string): Promise<void> {
    const result = await window.grdr.session.setStudentNote(sessionId, { studentId, text });
    if (result.ok) studentNotes.value = result.value.studentNotes;
    else errorMessage.value = result.error.message;
  }

  /** Deletes what is still waiting for its undo; called when the grid is left. */
  async function flushPending(): Promise<void> {
    await pending.flush();
  }

  onBeforeUnmount(() => {
    void flushPending();
  });

  return {
    categories,
    sortAscending,
    loading,
    errorMessage,
    model,
    studentOf,
    pendingDelete,
    pendingCount,
    load,
    loadAssessments,
    setSymbol,
    setPoints,
    clearResult,
    setNote,
    createShared,
    deleteShared,
    scheduleImpromptuDelete,
    undoDelete,
    setAbsence,
    setStudentNote,
    flushPending,
  };
}
