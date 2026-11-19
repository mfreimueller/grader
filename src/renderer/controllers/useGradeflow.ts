// Controller of the Gradeflow wizard: holds the state of every step and turns user actions into IPC calls.
// The components only render this state (AGENTS §11). Everything sent over IPC is a plain copy.

import { computed, reactive, ref, type UnwrapNestedRefs } from 'vue';
import type {
  ConfirmedRunDto,
  GradeflowProgressEventDto,
  GradeflowResultDto,
  GradeflowSettingsDto,
  PreparedRunDto,
  ProposalsDto,
  SaveResultDto,
  SkillListDto,
} from '../../shared/gradeflow-api';
import type { AssessmentDto, IpcApi } from '../../shared/types';
import { gradeflowErrorMessage, isOverwriteConfirmation } from '../utils/gradeflowErrors';
import { buildMatchRows, duplicateAssignments, studentLabel, toOverrides, type MatchRow } from '../utils/gradeflowMatching';
import { groupPreflight, hasPersonalDataRisk, toExcludedFiles } from '../utils/gradeflowPreflight';
import { emptyProgress, progressLabel, reduceProgress, type ProgressState } from '../utils/gradeflowProgress';
import {
  applyFailures,
  buildReviewRows,
  overwriteCount,
  rowProblem,
  toSaveRows,
  type ReviewRow,
} from '../utils/gradeflowReview';
import { eligibleAssessments, missingSetupFields, type AssessmentOption } from '../utils/gradeflowSetup';
import { plain } from '../utils/plain';

export type GradeflowStep = 'setup' | 'matching' | 'preflight' | 'running' | 'review' | 'done';
export type PathField = 'assignmentPath' | 'solutionPath' | 'handinsDir';

export interface GradeflowDeps {
  api: IpcApi['gradeflow'];
  /** Every assessment of the course, shared and impromptu. */
  loadAssessments: (courseId: string) => Promise<AssessmentDto[]>;
}

export type PickKind = 'file' | 'directory';

/** Assignment and solution may be a file or a folder; the hand-ins are always a folder. */
const PICK_REQUESTS: Readonly<Record<PathField, Readonly<Record<PickKind, { kind: PickKind; title: string }>>>> = {
  assignmentPath: {
    file: { kind: 'file', title: 'Aufgabenstellung wählen' },
    directory: { kind: 'directory', title: 'Aufgabenordner wählen' },
  },
  solutionPath: {
    file: { kind: 'file', title: 'Musterlösung wählen' },
    directory: { kind: 'directory', title: 'Musterlösungsordner wählen' },
  },
  handinsDir: {
    file: { kind: 'directory', title: 'Abgabenordner wählen' },
    directory: { kind: 'directory', title: 'Abgabenordner wählen' },
  },
};

/** The controller as the components see it: refs unwrapped, so `g.step` reads the value. */
export type GradeflowState = UnwrapNestedRefs<ReturnType<typeof useGradeflow>>;

export function useGradeflow(courseId: string, preselectedAssessmentId: string | null, deps: GradeflowDeps) {
  const { api } = deps;

  const step = ref<GradeflowStep>('setup');
  const busy = ref(false);
  const error = ref('');

  const form = reactive({
    assessmentId: '',
    assignmentPath: null as string | null,
    solutionPath: null as string | null,
    handinsDir: null as string | null,
    skillId: '',
  });
  const assessments = ref<AssessmentOption[]>([]);
  const skills = ref<SkillListDto>({ skills: [], invalid: [] });
  const settings = ref<GradeflowSettingsDto | null>(null);

  const prepared = ref<PreparedRunDto | null>(null);
  const matchRows = ref<MatchRow[]>([]);
  const confirmed = ref<ConfirmedRunDto | null>(null);
  const excluded = ref<string[]>([]);

  const progress = ref<ProgressState>(emptyProgress());
  const runError = ref<string | null>(null);

  const proposals = ref<ProposalsDto | null>(null);
  const reviewRows = ref<ReviewRow[]>([]);
  const saveResult = ref<SaveResultDto | null>(null);
  const overwriteConfirmation = ref<number | null>(null);

  let unsubscribe: (() => void) | null = null;

  const runId = (): string | null => prepared.value?.runId ?? null;
  const selectedAssessment = computed(() => assessments.value.find((a) => a.id === form.assessmentId) ?? null);
  const hasOpenRun = computed(() => prepared.value !== null && step.value !== 'done');
  const gradingType = computed(() => selectedAssessment.value?.gradingType ?? 'TERTIARY');
  const report = computed(() => confirmed.value?.report ?? []);
  const nameOf = (studentId: string): string => studentLabel(prepared.value?.students ?? [], studentId);
  const preflight = computed(() => groupPreflight(report.value, nameOf));
  const personalDataRisk = computed(() => hasPersonalDataRisk(report.value));
  const progressText = computed(() => progressLabel(progress.value));
  const rowProblems = computed(() => {
    const max = selectedAssessment.value?.maxPoints ?? null;
    return Object.fromEntries(
      reviewRows.value.flatMap((r) => {
        const problem = rowProblem(r, gradingType.value, max);
        return problem === null ? [] : [[r.studentId, problem] as const];
      }),
    );
  });
  const replaceCount = computed(() => overwriteCount(reviewRows.value));

  /** Runs a call that fills `error` on failure; resolves to the value or null. */
  async function guarded<T>(call: () => Promise<GradeflowResultDto<T>>): Promise<T | null> {
    error.value = '';
    busy.value = true;
    try {
      const result = await call();
      if (result.ok) return result.value;
      error.value = gradeflowErrorMessage(result.error);
      return null;
    } finally {
      busy.value = false;
    }
  }

  async function init(): Promise<void> {
    const [skillList, limits, all] = await Promise.all([api.listSkills(), api.getSettings(), deps.loadAssessments(courseId)]);
    if (skillList.ok) skills.value = skillList.value;
    else error.value = gradeflowErrorMessage(skillList.error);
    if (limits.ok) settings.value = limits.value;
    assessments.value = eligibleAssessments(all);
    if (preselectedAssessmentId && assessments.value.some((a) => a.id === preselectedAssessmentId)) {
      form.assessmentId = preselectedAssessmentId;
    }
  }

  async function pick(field: PathField, kind: PickKind = 'file'): Promise<void> {
    const path = await guarded(() => api.pickPath(PICK_REQUESTS[field][kind]));
    if (path !== null) form[field] = path;
  }

  const clearSolution = (): void => {
    form.solutionPath = null;
  };

  async function openSkillsFolder(): Promise<void> {
    await guarded(() => api.openSkillsFolder());
  }

  async function prepare(): Promise<void> {
    const missing = missingSetupFields(form);
    if (missing.length > 0) {
      error.value = `Bitte noch wählen: ${missing.join(', ')}`;
      return;
    }
    const value = await guarded(() =>
      api.prepare(
        plain({
          courseId,
          assessmentId: form.assessmentId,
          handinsDir: form.handinsDir as string,
          assignmentPath: form.assignmentPath as string,
          solutionPath: form.solutionPath,
          skillId: form.skillId,
        }),
      ),
    );
    if (value === null) return;
    prepared.value = value;
    matchRows.value = buildMatchRows(value);
    step.value = 'matching';
  }

  async function confirm(): Promise<void> {
    const id = runId();
    if (id === null) return;
    const duplicates = duplicateAssignments(matchRows.value);
    if (duplicates.length > 0) {
      error.value = `Mehrere Abgaben sind derselben Person zugeordnet: ${duplicates.map(nameOf).join(', ')}`;
      return;
    }
    if (matchRows.value.every((r) => r.selected === null)) {
      error.value = 'Bitte ordnen Sie mindestens eine Abgabe einer Person zu.';
      return;
    }
    const value = await guarded(() => api.confirm(id, plain(toOverrides(matchRows.value))));
    if (value === null) return;
    confirmed.value = value;
    excluded.value = [];
    step.value = 'preflight';
  }

  function toggleExclude(key: string): void {
    excluded.value = excluded.value.includes(key) ? excluded.value.filter((k) => k !== key) : [...excluded.value, key];
  }

  async function startRun(): Promise<void> {
    const id = runId();
    if (id === null) return;
    if (excluded.value.length > 0) {
      const files = toExcludedFiles(new Set(excluded.value), report.value);
      const removed = await guarded(() => api.excludeFiles(id, plain(files)));
      if (removed === null && error.value !== '') return;
      excluded.value = [];
    }
    await run(id);
  }

  async function run(id: string): Promise<void> {
    error.value = '';
    runError.value = null;
    progress.value = emptyProgress();
    step.value = 'running';
    let result: GradeflowResultDto<ProposalsDto>;
    try {
      result = await api.start(id);
    } catch {
      result = { ok: false, error: { name: 'InternalError', message: 'Internal error' } };
    }
    if (!result.ok) {
      runError.value = gradeflowErrorMessage(result.error);
      return;
    }
    proposals.value = result.value;
    reviewRows.value = buildReviewRows(result.value, gradingType.value);
    step.value = 'review';
  }

  async function retry(): Promise<void> {
    const id = runId();
    if (id !== null) await run(id);
  }

  async function cancel(): Promise<void> {
    const id = runId();
    if (id !== null) await api.cancel(id);
  }

  function reset(): void {
    prepared.value = null;
    matchRows.value = [];
    confirmed.value = null;
    excluded.value = [];
    progress.value = emptyProgress();
    runError.value = null;
    proposals.value = null;
    reviewRows.value = [];
    saveResult.value = null;
    overwriteConfirmation.value = null;
    error.value = '';
    step.value = 'setup';
  }

  async function discard(): Promise<void> {
    const id = runId();
    if (id === null) return;
    await api.discard(id);
    reset();
  }

  async function save(overwriteConfirmed = false): Promise<void> {
    const id = runId();
    if (id === null) return;
    const problems = Object.values(rowProblems.value);
    if (problems.length > 0) {
      error.value = problems[0] as string;
      return;
    }
    error.value = '';
    busy.value = true;
    try {
      const result = await api.save(id, plain(toSaveRows(reviewRows.value, gradingType.value)), overwriteConfirmed);
      if (result.ok) {
        saveResult.value = result.value;
        applyFailures(reviewRows.value, result.value.failed);
        if (result.value.failed.length === 0) step.value = 'done';
      } else if (isOverwriteConfirmation(result.error)) {
        overwriteConfirmation.value = result.error.count as number;
      } else {
        error.value = gradeflowErrorMessage(result.error);
      }
    } finally {
      busy.value = false;
    }
  }

  async function confirmOverwrite(): Promise<void> {
    overwriteConfirmation.value = null;
    await save(true);
  }

  const declineOverwrite = (): void => {
    overwriteConfirmation.value = null;
  };

  function onProgress(message: GradeflowProgressEventDto): void {
    if (message.runId === runId()) progress.value = reduceProgress(progress.value, message.event);
  }

  function attach(): void {
    unsubscribe ??= api.onProgress(onProgress);
  }

  function detach(): void {
    unsubscribe?.();
    unsubscribe = null;
  }

  return {
    step,
    busy,
    error,
    form,
    assessments,
    selectedAssessment,
    skills,
    settings,
    prepared,
    matchRows,
    confirmed,
    excluded,
    preflight,
    personalDataRisk,
    progressText,
    runError,
    proposals,
    reviewRows,
    rowProblems,
    replaceCount,
    saveResult,
    overwriteConfirmation,
    hasOpenRun,
    init,
    pick,
    clearSolution,
    openSkillsFolder,
    prepare,
    confirm,
    toggleExclude,
    startRun,
    retry,
    cancel,
    discard,
    save,
    confirmOverwrite,
    declineOverwrite,
    attach,
    detach,
  };
}
