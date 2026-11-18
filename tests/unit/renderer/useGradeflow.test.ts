import type {
  ConfirmedRunDto,
  GradeflowErrorDto,
  GradeflowProgressEventDto,
  GradeflowResultDto,
  PreparedRunDto,
  ProposalsDto,
  SaveResultDto,
  SkillListDto,
} from '../../../src/shared/gradeflow-api';
import type { AssessmentDto, IpcApi } from '../../../src/shared/types';
import { useGradeflow, type GradeflowDeps } from '../../../src/renderer/controllers/useGradeflow';

type Api = IpcApi['gradeflow'];

const ok = <T>(value: T): GradeflowResultDto<T> => ({ ok: true, value });
const fail = (error: Partial<GradeflowErrorDto> & { message?: string } = {}): GradeflowResultDto<never> => ({
  ok: false,
  error: { name: 'ValidationError', message: 'nope', ...error },
});

const skills: SkillListDto = {
  skills: [{ id: 'basic', name: 'Basis', description: 'd', model: null, source: 'bundled' }],
  invalid: [],
};

const prepared: PreparedRunDto = {
  runId: 'run-1',
  entries: [
    { moodleId: '1', fullName: 'Anna Bauer', alternativeNames: [], status: 'matched', studentId: 's1', candidateIds: [] },
    { moodleId: '2', fullName: 'Max Muster', alternativeNames: [], status: 'unmatched', studentId: null, candidateIds: [] },
  ],
  unrecognised: [],
  studentsWithoutHandin: [],
  conflicts: [],
  students: [
    { id: 's1', firstName: 'Anna', lastName: 'Bauer' },
    { id: 's2', firstName: 'Max', lastName: 'Muster' },
  ],
};

const confirmed: ConfirmedRunDto = {
  handinCount: 1,
  report: [
    { studentId: 's1', path: 'a.txt', kind: 'text', replacements: 1, loneNameHits: [], detail: null },
    { studentId: 's1', path: 'b.bin', kind: 'binary', replacements: 0, loneNameHits: [], detail: null },
  ],
};

const proposals: ProposalsDto = {
  rows: [
    { studentId: 's1', proposal: { symbol: 'WELLE', score: null }, comment: 'Gut', flags: [], current: null },
    { studentId: 's2', proposal: null, comment: '', flags: [], current: { symbol: 'PLUS', score: null, note: null } },
  ],
  missingStudentIds: ['s2'],
  costUsd: 0.4,
  durationMs: 5000,
};

const assessments: AssessmentDto[] = [
  {
    id: 'a1',
    title: 'Test 1',
    date: '2026-10-05T00:00:00.000Z',
    category: { id: 'c', title: 'Tests', gradingType: 'TERTIARY', displayAsGrade: false, isHidden: false },
    courseId: 'course',
    isImpromptu: false,
    maxPoints: null,
  },
  {
    id: 'imp',
    title: 'Mitarbeit',
    date: '2026-10-05T00:00:00.000Z',
    category: { id: 'm', title: 'Mitarbeit', gradingType: 'TERTIARY', displayAsGrade: false, isHidden: false },
    courseId: 'course',
    isImpromptu: true,
    maxPoints: null,
  },
];

function setup(overrides: Partial<Api> = {}, preselect: string | null = 'a1') {
  let progressListener: ((e: GradeflowProgressEventDto) => void) | null = null;
  const unsubscribe = jest.fn();
  const api: jest.Mocked<Api> = {
    listSkills: jest.fn().mockResolvedValue(ok(skills)),
    prepare: jest.fn().mockResolvedValue(ok(prepared)),
    confirm: jest.fn().mockResolvedValue(ok(confirmed)),
    excludeFiles: jest.fn().mockResolvedValue(ok(undefined)),
    start: jest.fn().mockResolvedValue(ok(proposals)),
    cancel: jest.fn().mockResolvedValue(ok(undefined)),
    save: jest.fn().mockResolvedValue(ok({ saved: 1, failed: [] } satisfies SaveResultDto)),
    discard: jest.fn().mockResolvedValue(ok(undefined)),
    pickPath: jest.fn(),
    getSettings: jest.fn().mockResolvedValue(ok({ maxBudgetUsd: 3, timeoutMinutes: 15 })),
    setSettings: jest.fn(),
    openSkillsFolder: jest.fn().mockResolvedValue(ok(undefined)),
    onProgress: jest.fn((cb) => {
      progressListener = cb;
      return unsubscribe;
    }),
    ...overrides,
  } as jest.Mocked<Api>;
  const deps: GradeflowDeps = { api, loadAssessments: jest.fn().mockResolvedValue(assessments) };
  const g = useGradeflow('course', preselect, deps);
  return { g, api, deps, unsubscribe, emit: (e: GradeflowProgressEventDto) => progressListener?.(e) };
}

async function readyForPrepare(t: ReturnType<typeof setup>): Promise<void> {
  await t.g.init();
  t.g.form.assignmentPath = '/in/task.pdf';
  t.g.form.handinsDir = '/in/moodle';
  t.g.form.skillId = 'basic';
}

async function toPreflight(t: ReturnType<typeof setup>): Promise<void> {
  await readyForPrepare(t);
  await t.g.prepare();
  await t.g.confirm();
}

describe('useGradeflow', () => {
  describe('init', () => {
    it('loads skills, limits and the assessments that can be graded, and preselects the one from the route', async () => {
      const t = setup();

      await t.g.init();

      expect(t.g.skills.value).toEqual(skills);
      expect(t.g.settings.value).toEqual({ maxBudgetUsd: 3, timeoutMinutes: 15 });
      expect(t.g.assessments.value.map((a) => a.id)).toEqual(['a1']);
      expect(t.g.form.assessmentId).toBe('a1');
      expect(t.g.step.value).toBe('setup');
    });

    it('ignores a preselection that cannot be graded', async () => {
      const t = setup({}, 'imp');

      await t.g.init();

      expect(t.g.form.assessmentId).toBe('');
    });

    it('shows a failed skill list', async () => {
      const t = setup({ listSkills: jest.fn().mockResolvedValue(fail({ name: 'InternalError' })) });

      await t.g.init();

      expect(t.g.error.value).toContain('interner Fehler');
    });
  });

  describe('choosing files', () => {
    it('stores the picked path and asks for the right kind of dialog', async () => {
      const t = setup({ pickPath: jest.fn().mockResolvedValue(ok('/in/task.pdf')) });

      await t.g.pick('assignmentPath');
      await t.g.pick('handinsDir');
      await t.g.pick('solutionPath');

      expect(t.g.form.assignmentPath).toBe('/in/task.pdf');
      expect(t.api.pickPath.mock.calls.map(([r]) => r.kind)).toEqual(['file', 'directory', 'file']);
    });

    it('keeps the old path when the dialog is cancelled', async () => {
      const t = setup({ pickPath: jest.fn().mockResolvedValue(ok(null)) });
      t.g.form.assignmentPath = '/old';

      await t.g.pick('assignmentPath');

      expect(t.g.form.assignmentPath).toBe('/old');
    });

    it('can clear the sample solution', () => {
      const t = setup();
      t.g.form.solutionPath = '/sol.pdf';

      t.g.clearSolution();

      expect(t.g.form.solutionPath).toBeNull();
    });

    it('shows an error of the dialog', async () => {
      const t = setup({ pickPath: jest.fn().mockResolvedValue(fail()) });

      await t.g.pick('handinsDir');

      expect(t.g.error.value).not.toBe('');
    });

    it('opens the skills folder and reports a failure', async () => {
      const t = setup();
      await t.g.openSkillsFolder();
      expect(t.api.openSkillsFolder).toHaveBeenCalled();
      expect(t.g.error.value).toBe('');

      t.api.openSkillsFolder.mockResolvedValue(fail({ name: 'OpenFolderError' }));
      await t.g.openSkillsFolder();
      expect(t.g.error.value).toContain('Ordner');
    });
  });

  describe('prepare', () => {
    it('names what is still missing and does not call the backend', async () => {
      const t = setup();
      await t.g.init();

      await t.g.prepare();

      expect(t.g.error.value).toBe('Bitte noch wählen: Aufgabenstellung, Abgabenordner, Bewertungs-Skill');
      expect(t.api.prepare).not.toHaveBeenCalled();
    });

    it('sends plain input and moves on to the matching', async () => {
      const t = setup();
      await readyForPrepare(t);

      await t.g.prepare();

      expect(t.api.prepare).toHaveBeenCalledWith({
        courseId: 'course',
        assessmentId: 'a1',
        handinsDir: '/in/moodle',
        assignmentPath: '/in/task.pdf',
        solutionPath: null,
        skillId: 'basic',
      });
      expect(() => structuredClone(t.api.prepare.mock.calls[0]?.[0])).not.toThrow();
      expect(t.g.step.value).toBe('matching');
      expect(t.g.matchRows.value.map((r) => r.selected)).toEqual(['s1', null]);
      expect(t.g.hasOpenRun.value).toBe(true);
    });

    it('stays in the setup and shows the error when the backend refuses', async () => {
      const t = setup({ prepare: jest.fn().mockResolvedValue(fail({ message: 'Another Gradeflow run is still open' })) });
      await readyForPrepare(t);

      await t.g.prepare();

      expect(t.g.step.value).toBe('setup');
      expect(t.g.error.value).toBe('Another Gradeflow run is still open');
      expect(t.g.busy.value).toBe(false);
    });
  });

  describe('confirm', () => {
    it('sends the changed rows as overrides and shows the pre-flight report', async () => {
      const t = setup();
      await readyForPrepare(t);
      await t.g.prepare();
      t.g.matchRows.value[1]!.selected = 's2';

      await t.g.confirm();

      expect(t.api.confirm).toHaveBeenCalledWith('run-1', [{ moodleId: '2', studentId: 's2' }]);
      expect(t.g.step.value).toBe('preflight');
      expect(t.g.preflight.value.map((g) => g.name)).toEqual(['Bauer Anna']);
      expect(t.g.personalDataRisk.value).toBe(true);
    });

    it('refuses two hand-ins for one student without calling the backend', async () => {
      const t = setup();
      await readyForPrepare(t);
      await t.g.prepare();
      t.g.matchRows.value[1]!.selected = 's1';

      await t.g.confirm();

      expect(t.api.confirm).not.toHaveBeenCalled();
      expect(t.g.error.value).toContain('Bauer Anna');
      expect(t.g.step.value).toBe('matching');
    });

    it('refuses an empty selection', async () => {
      const t = setup();
      await readyForPrepare(t);
      await t.g.prepare();
      t.g.matchRows.value[0]!.selected = null;

      await t.g.confirm();

      expect(t.api.confirm).not.toHaveBeenCalled();
      expect(t.g.error.value).toContain('mindestens');
    });

    it('shows a backend error and stays', async () => {
      const t = setup({ confirm: jest.fn().mockResolvedValue(fail({ message: 'boom' })) });
      await readyForPrepare(t);
      await t.g.prepare();

      await t.g.confirm();

      expect(t.g.step.value).toBe('matching');
      expect(t.g.error.value).toBe('boom');
    });
  });

  describe('starting a run', () => {
    it('removes the excluded files first, then runs and shows the review', async () => {
      const t = setup();
      await toPreflight(t);
      t.g.toggleExclude(t.g.preflight.value[0]!.files[1]!.key);

      await t.g.startRun();

      expect(t.api.excludeFiles).toHaveBeenCalledWith('run-1', [{ studentId: 's1', path: 'b.bin' }]);
      expect(t.api.start).toHaveBeenCalledWith('run-1');
      expect(t.g.step.value).toBe('review');
      expect(t.g.reviewRows.value.map((r) => [r.studentId, r.include])).toEqual([
        ['s1', true],
        ['s2', false],
      ]);
      expect(t.g.proposals.value?.costUsd).toBe(0.4);
    });

    it('does not call excludeFiles when nothing was excluded and lets a file be put back', async () => {
      const t = setup();
      await toPreflight(t);
      const key = t.g.preflight.value[0]!.files[0]!.key;
      t.g.toggleExclude(key);
      t.g.toggleExclude(key);

      await t.g.startRun();

      expect(t.api.excludeFiles).not.toHaveBeenCalled();
    });

    it('does not start when excluding fails', async () => {
      const t = setup({ excludeFiles: jest.fn().mockResolvedValue(fail({ message: 'no' })) });
      await toPreflight(t);
      t.g.toggleExclude(t.g.preflight.value[0]!.files[1]!.key);

      await t.g.startRun();

      expect(t.api.start).not.toHaveBeenCalled();
      expect(t.g.step.value).toBe('preflight');
      expect(t.g.error.value).toBe('no');
    });

    it('maps an agent failure to German text, keeps the run and allows another try', async () => {
      const t = setup({ start: jest.fn().mockResolvedValueOnce(fail({ name: 'AgentRunError', code: 'NOT_LOGGED_IN' })).mockResolvedValue(ok(proposals)) });
      await toPreflight(t);

      await t.g.startRun();

      expect(t.g.step.value).toBe('running');
      expect(t.g.runError.value).toContain('/login');
      expect(t.g.hasOpenRun.value).toBe(true);

      await t.g.retry();

      expect(t.api.start).toHaveBeenCalledTimes(2);
      expect(t.g.runError.value).toBeNull();
      expect(t.g.step.value).toBe('review');
    });

    it('shows the progress of the running agent and ignores events of other runs', async () => {
      let finish: (value: GradeflowResultDto<ProposalsDto>) => void = () => {};
      const t = setup({ start: jest.fn().mockReturnValue(new Promise((resolve) => (finish = resolve))) });
      await toPreflight(t);
      t.g.attach();

      const running = t.g.startRun();
      await Promise.resolve();
      t.emit({ runId: 'run-1', event: { kind: 'started', model: 'sonnet' } });
      t.emit({ runId: 'run-1', event: { kind: 'reading', studentId: 's1' } });
      t.emit({ runId: 'other', event: { kind: 'reading', studentId: 's2' } });

      expect(t.g.progressText.value).toBe('Modell Sonnet · 0 Schritte · bisher 1 Abgabe gelesen');
      finish(ok(proposals));
      await running;
    });

    it('treats a call that throws like an internal error and keeps the run', async () => {
      const t = setup({ start: jest.fn().mockRejectedValue(new Error('ipc gone')) });
      await toPreflight(t);

      await t.g.startRun();

      expect(t.g.runError.value).toContain('interner Fehler');
      expect(t.g.hasOpenRun.value).toBe(true);
    });

    it('cancels a running agent', async () => {
      const t = setup();
      await toPreflight(t);

      await t.g.cancel();

      expect(t.api.cancel).toHaveBeenCalledWith('run-1');
    });
  });

  describe('attach and detach', () => {
    it('subscribes once and unsubscribes on detach', () => {
      const t = setup();

      t.g.attach();
      t.g.detach();

      expect(t.api.onProgress).toHaveBeenCalledTimes(1);
      expect(t.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('detaching without attaching is harmless', () => {
      expect(() => setup().g.detach()).not.toThrow();
    });
  });

  describe('discard', () => {
    it('drops the run and returns to the setup with a clean slate', async () => {
      const t = setup();
      await toPreflight(t);

      await t.g.discard();

      expect(t.api.discard).toHaveBeenCalledWith('run-1');
      expect(t.g.step.value).toBe('setup');
      expect(t.g.hasOpenRun.value).toBe(false);
      expect(t.g.matchRows.value).toEqual([]);
      expect(t.g.form.assignmentPath).toBe('/in/task.pdf');
    });

    it('does nothing without a run', async () => {
      const t = setup();

      await t.g.discard();

      expect(t.api.discard).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    async function toReview(t: ReturnType<typeof setup>): Promise<void> {
      await toPreflight(t);
      await t.g.startRun();
    }

    it('saves the rows and finishes when all went well', async () => {
      const t = setup();
      await toReview(t);
      t.g.reviewRows.value[0]!.comment = 'Besser';

      await t.g.save();

      expect(t.api.save).toHaveBeenCalledWith(
        'run-1',
        [
          { studentId: 's1', symbol: 'WELLE', comment: 'Besser', include: true },
          { studentId: 's2', comment: '', include: false },
        ],
        false,
      );
      expect(() => structuredClone(t.api.save.mock.calls[0]?.[1])).not.toThrow();
      expect(t.g.step.value).toBe('done');
      expect(t.g.saveResult.value).toEqual({ saved: 1, failed: [] });
      expect(t.g.hasOpenRun.value).toBe(false);
    });

    it('does not save while a ticked row has a problem', async () => {
      const t = setup();
      await toReview(t);
      t.g.reviewRows.value[0]!.symbol = null;

      await t.g.save();

      expect(t.api.save).not.toHaveBeenCalled();
      expect(t.g.error.value).toContain('Bitte eine Beurteilung wählen');
      expect(t.g.rowProblems.value['s1']).toBe('Bitte eine Beurteilung wählen.');
    });

    it('asks to confirm replacing results, then saves again with the confirmation', async () => {
      const t = setup({
        save: jest
          .fn()
          .mockResolvedValueOnce(fail({ name: 'OverwriteNeedsConfirmationError', count: 2 }))
          .mockResolvedValue(ok({ saved: 1, failed: [] })),
      });
      await toReview(t);

      await t.g.save();
      expect(t.g.overwriteConfirmation.value).toBe(2);
      expect(t.g.step.value).toBe('review');

      await t.g.confirmOverwrite();
      expect(t.api.save).toHaveBeenLastCalledWith('run-1', expect.any(Array), true);
      expect(t.g.overwriteConfirmation.value).toBeNull();
      expect(t.g.step.value).toBe('done');
    });

    it('drops the confirmation question when the teacher declines', async () => {
      const t = setup({ save: jest.fn().mockResolvedValue(fail({ name: 'OverwriteNeedsConfirmationError', count: 1 })) });
      await toReview(t);
      await t.g.save();

      t.g.declineOverwrite();

      expect(t.g.overwriteConfirmation.value).toBeNull();
      expect(t.api.save).toHaveBeenCalledTimes(1);
    });

    it('keeps failed rows for another try and does not save the done ones twice', async () => {
      const t = setup({
        save: jest.fn().mockResolvedValue(ok({ saved: 1, failed: [{ studentId: 's2', message: 'kaputt' }] })),
      });
      await toReview(t);
      t.g.reviewRows.value[1]!.include = true;
      t.g.reviewRows.value[1]!.symbol = 'PLUS';

      await t.g.save();

      expect(t.g.step.value).toBe('review');
      expect(t.g.saveResult.value).toEqual({ saved: 1, failed: [{ studentId: 's2', message: 'kaputt' }] });
      expect(t.g.reviewRows.value.map((r) => [r.studentId, r.include, r.saved, r.failure])).toEqual([
        ['s1', false, true, null],
        ['s2', true, false, 'kaputt'],
      ]);
      expect(t.g.hasOpenRun.value).toBe(true);
    });

    it('shows other save errors', async () => {
      const t = setup({ save: jest.fn().mockResolvedValue(fail({ message: 'There is no result to save yet' })) });
      await toReview(t);

      await t.g.save();

      expect(t.g.error.value).toBe('There is no result to save yet');
      expect(t.g.step.value).toBe('review');
    });
  });

  describe('without an open run', () => {
    it('ignores every action that needs one', async () => {
      const t = setup();

      await t.g.confirm();
      await t.g.startRun();
      await t.g.retry();
      await t.g.cancel();
      await t.g.save();

      expect(t.api.confirm).not.toHaveBeenCalled();
      expect(t.api.start).not.toHaveBeenCalled();
      expect(t.api.cancel).not.toHaveBeenCalled();
      expect(t.api.save).not.toHaveBeenCalled();
    });

    it('ignores progress that arrives while no run is open', () => {
      const t = setup();
      t.g.attach();
      t.g.attach();

      t.emit({ runId: 'x', event: { kind: 'finished' } });

      expect(t.api.onProgress).toHaveBeenCalledTimes(1);
      expect(t.g.progressText.value).toBe('Der Agent wird gestartet …');
    });
  });

  describe('init without a preselection or limits', () => {
    it('leaves the assessment open and tolerates unreadable limits', async () => {
      const t = setup({ getSettings: jest.fn().mockResolvedValue(fail()) }, null);

      await t.g.init();

      expect(t.g.form.assessmentId).toBe('');
      expect(t.g.settings.value).toBeNull();
    });
  });

  describe('a points assessment', () => {
    const numeric: AssessmentDto = {
      ...assessments[0]!,
      category: { ...assessments[0]!.category, gradingType: 'NUMERIC' },
      maxPoints: 10,
    };

    it('proposes points, keeps them within the maximum and saves the score', async () => {
      const t = setup();
      (t.deps.loadAssessments as jest.Mock).mockResolvedValue([numeric]);
      t.api.start.mockResolvedValue(
        ok({ ...proposals, rows: [{ studentId: 's1', proposal: { symbol: null, score: 5 }, comment: '', flags: [], current: null }] }),
      );
      await toPreflight(t);
      await t.g.startRun();

      t.g.reviewRows.value[0]!.score = 11;
      expect(t.g.rowProblems.value['s1']).toBe('Punkte zwischen 0 und 10 eingeben.');

      t.g.reviewRows.value[0]!.score = 7.5;
      await t.g.save();

      expect(t.api.save).toHaveBeenCalledWith('run-1', [{ studentId: 's1', score: 7.5, comment: '', include: true }], false);
    });
  });
});
