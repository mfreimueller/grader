import { extname } from 'node:path';
import { AgentProgress, AgentRunError, DEFAULT_MODEL } from '../domain/gradeflow/AgentRunner';
import { buildGradingPrompt } from '../domain/gradeflow/GradingPrompt';
import { parseGradingProposal } from '../domain/gradeflow/GradingProposal';
import { ConfirmedHandin, confirmMatches, HandinMatchResult, matchHandins } from '../domain/gradeflow/HandinMatcher';
import { BuiltWorkspace } from '../domain/gradeflow/HandinWorkspaceBuilder';
import { groupHandins } from '../domain/gradeflow/MoodleHandinFolder';
import { outputJsonSchema, renderOutputInstructions } from '../domain/gradeflow/OutputInstructions';
import { PseudonymMap } from '../domain/gradeflow/PseudonymMap';
import { workspaceMaterialName } from '../domain/gradeflow/WorkspaceMaterial';
import { generateId } from '../domain/shared/IdGenerator';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import { buildJideWorkspace, forgetExcludedFiles, JIDE_NOT_AVAILABLE, loadJideRun, reviewOf, sendToJide } from './GradeflowJide';
import { checkInput, checkJideInput, currentResults } from './GradeflowPrepare';
import type { RunState } from './GradeflowRunState';
import { saveRows } from './GradeflowSaver';
import type {
  ConfirmedRunDto,
  GradeflowDeps,
  GradeflowProgressDto,
  MatchOverride,
  PrepareInput,
  PrepareJideInput,
  PreparedRunDto,
  ProposalsDto,
  SaveResultDto,
  SaveRow,
  SkillListDto,
} from './GradeflowTypes';

const invalid = (message: string): Result<never> => Result.fail(new ValidationError(message));

/**
 * Orchestrates one AI-assisted grading run: match, build a pseudonymised workspace, run the agent, review, save.
 * Run state lives in memory only and only one run exists at a time. Tokens never leave this class, and nothing
 * here logs names, paths, comments or tokens.
 */
export class GradeflowService {
  private readonly runs = new Map<string, RunState>();

  constructor(private readonly deps: GradeflowDeps) {}

  async listSkills(): Promise<SkillListDto> {
    const { skills, invalid: broken } = await this.deps.skillCatalog.list();
    return {
      skills: skills.map(({ id, name, description, model, source }) => ({ id, name, description, model, source })),
      invalid: broken.map(({ id, reason }) => ({ id, reason })),
    };
  }

  async prepare(input: PrepareInput): Promise<Result<PreparedRunDto>> {
    if (this.runs.size > 0) return invalid('Another Gradeflow run is still open');
    const checked = await checkInput(this.deps, input);
    if (!checked.ok) return Result.fail(checked.error);
    const { assignmentKind, solutionKind, assessment, skill, students } = checked.value;

    const folders = await this.deps.handinDirectory.listFolderNames(input.handinsDir);
    if (!folders.ok) return Result.fail(folders.error);
    const grouped = groupHandins(folders.value);
    const match = matchHandins(grouped.handins, students);

    const runId = generateId();
    this.runs.set(runId, {
      phase: 'prepared',
      input,
      assignmentKind,
      solutionKind,
      assessment,
      skill,
      students,
      match,
      pseudonyms: null,
      workspace: null,
      abort: null,
      jide: null,
    });
    this.deps.debug?.(`prepare handins=${grouped.handins.length} unrecognised=${grouped.unrecognised.length}`);
    return Result.ok(
      this.preparedDto(runId, match, students, { source: 'moodle', exercise: null, unrecognised: grouped.unrecognised }),
    );
  }

  /** Prepares a run on the latest J;DE hand-ins of one exercise; hand-ins are matched through the stored links. */
  async prepareJide(input: PrepareJideInput): Promise<Result<PreparedRunDto>> {
    if (this.runs.size > 0) return invalid('Another Gradeflow run is still open');
    if (!this.deps.jide) return invalid(JIDE_NOT_AVAILABLE);
    const checked = await checkJideInput(this.deps, input);
    if (!checked.ok) return Result.fail(checked.error);
    const { assessment, skill, students } = checked.value;
    const loaded = await loadJideRun(this.deps, input, students);
    if (!loaded.ok) return Result.fail(loaded.error);
    const { jide, match } = loaded.value;

    const runId = generateId();
    this.runs.set(runId, {
      phase: 'prepared',
      // No paths: the material is the J;DE package, the hand-ins come from J;DE.
      input: { courseId: input.courseId, assessmentId: input.assessmentId, handinsDir: '', assignmentPath: '', solutionPath: null, skillId: input.skillId },
      assignmentKind: 'directory',
      solutionKind: null,
      assessment,
      skill,
      students,
      match,
      pseudonyms: null,
      workspace: null,
      abort: null,
      jide,
    });
    this.deps.debug?.(`prepareJide handins=${match.entries.length}`);
    return Result.ok(this.preparedDto(runId, match, students, { source: 'jide', exercise: { title: jide.exercise.title, slug: jide.exercise.slug }, unrecognised: [] }));
  }

  async confirm(runId: string, overrides: MatchOverride[]): Promise<Result<ConfirmedRunDto>> {
    const state = this.idle(runId);
    if (!state.ok) return Result.fail(state.error);
    const run = state.value;

    // J;DE hand-ins are matched through the stored links only; fixing a link is done in the link panel.
    if (run.jide && overrides.length > 0) return invalid('J;DE hand-ins cannot be assigned by hand');
    const confirmed = confirmMatches(run.match, new Map(overrides.map((o) => [o.moodleId, o.studentId])));
    if (!confirmed.ok) return Result.fail(confirmed.error);
    if (confirmed.value.length === 0) return invalid('No hand-in is assigned to a student');
    const pseudonyms = PseudonymMap.create(
      confirmed.value.map((handin) => handin.studentId),
      this.deps.randomIndex,
    );
    if (!pseudonyms.ok) return Result.fail(pseudonyms.error);
    const instructions = renderOutputInstructions({
      gradingType: run.assessment.gradingType,
      maxPoints: run.assessment.maxPoints,
      tokens: pseudonyms.value.tokens(),
      source: run.jide ? 'jide' : 'moodle',
    });
    if (!instructions.ok) return Result.fail(instructions.error);

    await this.dropWorkspace(run);
    const built = run.jide
      ? await buildJideWorkspace(this.deps, run, run.jide, confirmed.value, pseudonyms.value, instructions.value)
      : await this.buildMoodleWorkspace(run, confirmed.value, pseudonyms.value, instructions.value);
    if (!built.ok) return Result.fail(built.error);

    run.pseudonyms = pseudonyms.value;
    run.workspace = built.value;
    run.phase = 'built';
    const report = built.value.report.flatMap((entry) => {
      const studentId = pseudonyms.value.studentOf(entry.token);
      if (studentId === null) return [];
      return [
        {
          studentId,
          path: entry.path,
          kind: entry.kind,
          replacements: entry.replacements ?? 0,
          loneNameHits: entry.loneNameHits ?? [],
          detail: entry.detail ?? null,
        },
      ];
    });
    this.deps.debug?.(`confirm handins=${confirmed.value.length} reportEntries=${report.length}`);
    return Result.ok({ handinCount: confirmed.value.length, report });
  }

  async excludeFiles(runId: string, files: { studentId: string; path: string }[]): Promise<Result<void>> {
    const state = this.built(runId);
    if (!state.ok) return Result.fail(state.error);
    const { workspace, pseudonyms } = state.value;

    const byToken = new Map<string, string[]>();
    for (const file of files) {
      const token = pseudonyms.tokenOf(file.studentId);
      if (token === null) return invalid('A file belongs to a student who is not part of this run');
      byToken.set(token, [...(byToken.get(token) ?? []), file.path]);
    }
    for (const [token, paths] of byToken) {
      const removed = await this.deps.workspaceBuilder.removeFiles(workspace.root, token, paths);
      if (!removed.ok) return Result.fail(removed.error);
      const studentId = pseudonyms.studentOf(token);
      if (state.value.run.jide && studentId !== null) forgetExcludedFiles(state.value.run.jide, studentId, paths);
    }
    return Result.ok(undefined as void);
  }

  async start(runId: string, onProgress: (event: GradeflowProgressDto) => void): Promise<Result<ProposalsDto>> {
    const state = this.built(runId);
    if (!state.ok) return Result.fail(state.error);
    const { run, workspace, pseudonyms } = state.value;
    if (run.phase === 'running') return invalid('The agent is already running');

    const { maxBudgetUsd, timeoutMs } = this.deps.settings();
    const schema = outputJsonSchema({
      gradingType: run.assessment.gradingType,
      maxPoints: run.assessment.maxPoints,
      tokens: pseudonyms.tokens(),
      source: run.jide ? 'jide' : 'moodle',
    });
    if (!schema.ok) return Result.fail(schema.error);

    // No await before the agent starts: a cancel right after this call must find the controller.
    const abort = new AbortController();
    run.abort = abort;
    run.phase = 'running';
    const outcome = await this.deps.agentRunner.run(
      {
        workspaceRoot: workspace.root,
        prompt: buildGradingPrompt({
          skillId: run.input.skillId,
          assignment: {
            name: workspaceMaterialName('assignment', run.assignmentKind, extname(run.input.assignmentPath)),
            kind: run.assignmentKind,
          },
          solution:
            run.input.solutionPath === null || run.solutionKind === null
              ? null
              : {
                  name: workspaceMaterialName('solution', run.solutionKind, extname(run.input.solutionPath)),
                  kind: run.solutionKind,
                },
          tokenCount: pseudonyms.size,
          source: run.jide ? 'jide' : 'moodle',
        }),
        jsonSchema: schema.value,
        model: run.skill.model ?? DEFAULT_MODEL,
        maxBudgetUsd,
        timeoutMs,
      },
      (event) => {
        const mapped = this.mapProgress(event, pseudonyms);
        if (mapped !== null) onProgress(mapped);
      },
      abort.signal,
    );
    run.abort = null;
    run.phase = 'built';
    if (!outcome.ok) return Result.fail<ProposalsDto, AgentRunError>(outcome.error);

    const parsed = parseGradingProposal(outcome.value.structuredOutput, {
      gradingType: run.assessment.gradingType,
      maxPoints: run.assessment.maxPoints,
      pseudonyms,
      ...(run.jide ? { jideFiles: run.jide.files } : {}),
    });
    if (!parsed.ok) return Result.fail(parsed.error);

    const current = await currentResults(this.deps, run.assessment);
    const proposals = new Map(parsed.value.proposals.map((p) => [p.studentId, p]));
    run.phase = 'proposed';
    this.deps.debug?.(
      `run costUsd=${outcome.value.costUsd ?? 0} durationMs=${outcome.value.durationMs} rows=${pseudonyms.size} missing=${parsed.value.missingStudentIds.length}`,
    );
    const { jide } = run;
    return Result.ok({
      source: jide ? 'jide' : 'moodle',
      rows: pseudonyms.studentIds().map((studentId) => {
        const proposal = proposals.get(studentId);
        const review = jide ? reviewOf(jide, studentId, proposal?.lineComments ?? []) : undefined;
        return {
          studentId,
          proposal: proposal ? { symbol: proposal.symbol, score: proposal.score } : null,
          comment: proposal?.comment ?? '',
          flags: proposal?.flags ?? [],
          current: current.get(studentId) ?? null,
          ...(review ? { jide: review } : {}),
        };
      }),
      missingStudentIds: parsed.value.missingStudentIds,
      costUsd: outcome.value.costUsd,
      durationMs: outcome.value.durationMs,
    });
  }

  async cancel(runId: string): Promise<Result<void>> {
    const run = this.runs.get(runId);
    if (!run) return Result.fail(new NotFoundError('Gradeflow run', runId));
    run.abort?.abort();
    return Result.ok(undefined as void);
  }

  async save(runId: string, rows: SaveRow[], overwriteConfirmed: boolean): Promise<Result<SaveResultDto>> {
    const run = this.runs.get(runId);
    if (!run) return Result.fail(new NotFoundError('Gradeflow run', runId));
    if (run.phase !== 'proposed' || run.pseudonyms === null) return invalid('There is no result to save yet');

    // A J;DE retry of a row that is saved in Grader already must not ask about replacing it again.
    const graderRows = run.jide ? rows.map((row) => (row.skipGrader ? { ...row, include: false } : row)) : rows;
    const saved = await saveRows(
      this.deps,
      { assessmentId: run.assessment.id, gradingType: run.assessment.gradingType, studentIds: run.pseudonyms.studentIds() },
      graderRows,
      overwriteConfirmed,
    );
    if (!saved.ok) return Result.fail(saved.error);
    // Saving in Grader and sending to J;DE are independent: each is reported on its own, nothing is dropped silently.
    const sent = run.jide ? await sendToJide(this.deps, run.jide, rows) : null;
    const result: SaveResultDto = sent ? { ...saved.value, jide: sent } : saved.value;
    // The hand-ins must not linger; the rows stay so the teacher can retry the failed ones.
    await this.dropWorkspace(run);
    const retryable = result.failed.length > 0 || (sent ?? []).some((s) => s.status === 'error');
    if (!retryable) this.runs.delete(runId);
    return Result.ok(result);
  }

  async discard(runId: string): Promise<Result<void>> {
    const run = this.runs.get(runId);
    if (run) await this.dropRun(runId, run);
    return Result.ok(undefined as void);
  }

  /** App quit: stops the agent and removes the workspace of the open run. */
  async disposeAll(): Promise<void> {
    for (const [runId, run] of [...this.runs]) await this.dropRun(runId, run);
  }

  private buildMoodleWorkspace(
    run: RunState,
    handins: ConfirmedHandin[],
    pseudonyms: PseudonymMap,
    outputInstructions: string,
  ): Promise<Result<BuiltWorkspace>> {
    return this.deps.workspaceBuilder.build({
      handinsDir: run.input.handinsDir,
      assignmentPath: run.input.assignmentPath,
      assignmentKind: run.assignmentKind,
      solutionPath: run.input.solutionPath,
      solutionKind: run.solutionKind,
      handins,
      pseudonyms,
      students: run.students.map(({ firstName, lastName }) => ({ firstName, lastName })),
      outputInstructions,
      skill: { id: run.input.skillId, dir: run.skill.dir },
    });
  }

  private preparedDto(
    runId: string,
    match: HandinMatchResult,
    students: RunState['students'],
    extra: Pick<PreparedRunDto, 'source' | 'exercise' | 'unrecognised'>,
  ): PreparedRunDto {
    return {
      runId,
      ...extra,
      entries: match.entries.map(({ handin, match: m }) => ({
        moodleId: handin.moodleId,
        fullName: handin.fullName,
        alternativeNames: handin.alternativeNames,
        status: m.status,
        studentId: m.status === 'matched' ? m.studentId : null,
        candidateIds: m.status === 'ambiguous' ? m.candidateIds : [],
      })),
      studentsWithoutHandin: match.studentsWithoutHandin,
      conflicts: match.conflicts,
      students: students.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    };
  }

  private async dropRun(runId: string, run: RunState): Promise<void> {
    run.abort?.abort();
    this.runs.delete(runId);
    await this.dropWorkspace(run);
  }

  private async dropWorkspace(run: RunState): Promise<void> {
    const { workspace } = run;
    run.workspace = null;
    if (workspace) await this.deps.workspaceBuilder.cleanup(workspace.root);
  }

  private idle(runId: string): Result<RunState> {
    const run = this.runs.get(runId);
    if (!run) return Result.fail(new NotFoundError('Gradeflow run', runId));
    if (run.phase === 'running') return invalid('The agent is running');
    return Result.ok(run);
  }

  private built(runId: string): Result<{ run: RunState; workspace: BuiltWorkspace; pseudonyms: PseudonymMap }> {
    const run = this.runs.get(runId);
    if (!run) return Result.fail(new NotFoundError('Gradeflow run', runId));
    if (!run.workspace || !run.pseudonyms) return invalid('The workspace has not been built yet');
    return Result.ok({ run, workspace: run.workspace, pseudonyms: run.pseudonyms });
  }

  private mapProgress(event: AgentProgress, pseudonyms: PseudonymMap): GradeflowProgressDto | null {
    if (event.kind !== 'reading') return event;
    const studentId = pseudonyms.studentOf(event.token);
    return studentId === null ? null : { kind: 'reading', studentId };
  }

}
