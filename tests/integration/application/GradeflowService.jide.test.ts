import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FindingService } from '../../../src/application/FindingService';
import { GradeflowService } from '../../../src/application/GradeflowService';
import type { GradeflowDeps, SaveRow } from '../../../src/application/GradeflowTypes';
import { GradingService } from '../../../src/application/GradingService';
import { OverwriteNeedsConfirmationError } from '../../../src/application/GradeflowSaver';
import {
  AgentRunError,
  AgentRunOutcome,
  AgentRunRequest,
  AgentRunner,
} from '../../../src/domain/gradeflow/AgentRunner';
import type { BuildJideWorkspaceInput, BuiltJideWorkspace } from '../../../src/domain/gradeflow/JideWorkspaceBuilder';
import { JideApiError, type JideHandin } from '../../../src/domain/jide/JideApi';
import { Result } from '../../../src/domain/shared/Result';
import { FsHandinWorkspaceBuilder } from '../../../src/infrastructure/gradeflow/FsHandinWorkspaceBuilder';
import { SqliteFindingRepository } from '../../../src/infrastructure/persistence/SqliteFindingRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteUnitOfWork } from '../../../src/infrastructure/persistence/SqliteUnitOfWork';
import { SessionService } from '../../../src/application/SessionService';
import { AssessmentService } from '../../../src/application/AssessmentService';
import { buildZip } from '../infrastructure/gradeflow/zipFixture';
import { createJideFixture, errorOf, FakeJideApi, JideFixture, valueOf } from './jideHarness';

const PACKAGE = buildZip([
  { name: 'exercise.yaml', data: 'id: summe\n' },
  { name: 'aufgabe.md', data: '# Summe\n' },
  { name: 'files/Summe.java', data: 'class Summe {}\n' },
]);

const handin = (patch: Partial<JideHandin>): JideHandin => ({
  handinId: '501',
  studentId: '11',
  submittedAt: '2026-11-10T09:00:00Z',
  late: false,
  testsPassed: 1,
  testsTotal: 2,
  graded: false,
  files: [{ path: 'Summe.java', content: 'class Summe {\n  int x;\n  // Max Mustermann\n}\n' }],
  ...patch,
});

/** Records the pseudonyms of the last build so the fake agent can answer with the right tokens. */
class RecordingBuilder extends FsHandinWorkspaceBuilder {
  last: BuildJideWorkspaceInput | null = null;
  roots: string[] = [];
  override async buildJide(input: BuildJideWorkspaceInput): Promise<Result<BuiltJideWorkspace>> {
    this.last = input;
    const built = await super.buildJide(input);
    if (built.ok) this.roots.push(built.value.root);
    return built;
  }
  token(studentId: string): string {
    const token = this.last?.pseudonyms.tokenOf(studentId);
    if (!token) throw new Error('no token');
    return token;
  }
}

class FakeRunner implements AgentRunner {
  requests: AgentRunRequest[] = [];
  respond: () => unknown = () => ({ version: 1, results: [] });
  async run(request: AgentRunRequest): Promise<Result<AgentRunOutcome, AgentRunError>> {
    this.requests.push(request);
    return Result.ok({ structuredOutput: this.respond(), costUsd: 0.1, durationMs: 1000, turns: 3, permissionDenials: 0 });
  }
}

describe('GradeflowService: J;DE runs', () => {
  let fixture: JideFixture;
  let api: FakeJideApi;
  let builder: RecordingBuilder;
  let runner: FakeRunner;
  let gradingService: GradingService;
  let findingService: FindingService;
  let courseLink: string | null;
  let studentLinks: Map<string, string>;
  let skillDir: string;
  let counter: number;
  let overrides: Partial<GradeflowDeps>;
  let withJide: boolean;

  const createService = (): GradeflowService =>
    new GradeflowService({
      rosterService: fixture.rosterService,
      sessionService: fixture.sessionService as unknown as SessionService,
      assessmentService: fixture.assessmentService as unknown as AssessmentService,
      gradingService,
      findingService,
      workspaceBuilder: builder,
      jideWorkspaceBuilder: builder,
      handinDirectory: { listFolderNames: async () => Result.ok([]), kindOf: async () => null },
      skillCatalog: {
        list: async () => ({
          skills: [{ id: 'java-jide', name: 'Java J;DE', description: 'x', model: null, source: 'bundled' }],
          invalid: [],
        }),
        dirOf: async (id) => (id === 'java-jide' ? skillDir : null),
      },
      agentRunner: runner,
      randomIndex: () => {
        counter += 1;
        return counter % 36;
      },
      settings: () => ({ maxBudgetUsd: 2, timeoutMs: 60_000 }),
      ...(withJide
        ? {
            jide: {
              api: async () => Result.ok(api),
              linkedJideCourseId: async () => courseLink,
              studentLinksOf: async () => studentLinks,
            },
          }
        : {}),
      ...overrides,
    });
  let service: GradeflowService;

  const input = (patch: Partial<Parameters<GradeflowService['prepareJide']>[0]> = {}) => ({
    courseId: 'course-1',
    assessmentId: fixture.tertiaryId,
    jideExerciseId: '3',
    skillId: 'java-jide',
    ...patch,
  });

  const prepared = async (): Promise<string> => valueOf(await service.prepareJide(input())).runId;
  const confirmed = async (): Promise<string> => {
    const runId = await prepared();
    valueOf(await service.confirm(runId, []));
    return runId;
  };
  const output = (lineComments: unknown[] = []): unknown => ({
    version: 1,
    results: [
      { token: builder.token('s-max'), symbol: 'PLUS', comment: 'Du hast das gut gelöst.', lineComments },
      { token: builder.token('s-anna'), symbol: 'WELLE', comment: 'Fast geschafft.', lineComments: [] },
    ],
  });
  const proposed = async (lineComments: unknown[] = []): Promise<string> => {
    const runId = await confirmed();
    runner.respond = () => output(lineComments);
    return valueOf(await service.start(runId, () => undefined)) && runId;
  };
  const rows = (...entries: Partial<SaveRow>[]): SaveRow[] =>
    entries.map((entry) => ({ studentId: 's-max', symbol: 'PLUS', comment: 'Gut.', include: true, lineComments: [], ...entry }));

  beforeEach(async () => {
    fixture = await createJideFixture();
    api = new FakeJideApi();
    api.handins = Result.ok([
      handin({}),
      handin({ handinId: '502', studentId: '12', files: [{ path: 'src/Anna.java', content: 'class Anna {}\n' }] }),
      handin({ handinId: '503', studentId: '13' }),
    ]);
    api.packageZip = Result.ok(new Uint8Array(PACKAGE));
    builder = new RecordingBuilder();
    runner = new FakeRunner();
    counter = 0;
    overrides = {};
    withJide = true;
    courseLink = '7';
    studentLinks = new Map([
      ['s-max', '11'],
      ['s-anna', '12'],
    ]);
    skillDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jide-skill-'));
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: N\ndescription: D\n---\n');
    const { db } = fixture;
    const gradeRepo = new SqliteGradeRepository(db);
    gradingService = new GradingService(
      gradeRepo,
      fixture.courseRepo,
      gradeRepo,
      new SqliteStudentRepository(db),
      new SqliteAssessmentRepository(db),
      new SqliteSessionRepository(db),
    );
    findingService = new FindingService(new SqliteFindingRepository(db), new SqliteUnitOfWork(db));
    service = createService();
  });

  afterEach(async () => {
    await service.disposeAll();
    for (const root of builder.roots) await builder.cleanup(root);
    await fs.rm(skillDir, { recursive: true, force: true });
    fixture.db.close();
  });

  describe('prepareJide', () => {
    it('matches the latest hand-ins through the links, not through names', async () => {
      const run = valueOf(await service.prepareJide(input()));
      expect(run.source).toBe('jide');
      expect(run.exercise).toEqual({ title: 'Summe', slug: 'summe' });
      expect(run.entries).toEqual([
        { moodleId: '501', fullName: 'Max Mustermann', alternativeNames: [], status: 'matched', studentId: 's-max', candidateIds: [] },
        { moodleId: '502', fullName: 'Bauer Anna', alternativeNames: [], status: 'matched', studentId: 's-anna', candidateIds: [] },
        { moodleId: '503', fullName: 'Eva Fremd', alternativeNames: [], status: 'unmatched', studentId: null, candidateIds: [] },
      ]);
      expect(run.studentsWithoutHandin).toEqual(['s-zoe']);
      expect(run.unrecognised).toEqual([]);
      expect(api.calls).toEqual(['listExercises 7', 'listCourses', 'listHandins 7 3', 'fetchPackage 3']);
    });

    it('does not use a link for a name that looks alike', async () => {
      studentLinks = new Map();
      const run = valueOf(await service.prepareJide(input()));
      expect(run.entries.every((e) => e.status === 'unmatched')).toBe(true);
    });

    it('needs a linked J;DE course', async () => {
      courseLink = null;
      expect(errorOf(await service.prepareJide(input())).message).toContain('nicht mit einem J;DE-Kurs verknüpft');
    });

    it('refuses an exercise of another course', async () => {
      expect(errorOf(await service.prepareJide(input({ jideExerciseId: '99' }))).message).toContain('nicht zum verknüpften J;DE-Kurs');
    });

    it('refuses a points column: J;DE grades are symbols', async () => {
      expect(errorOf(await service.prepareJide(input({ assessmentId: fixture.numericId }))).message).toContain('Symbole');
    });

    it('says so when nobody handed in', async () => {
      api.handins = Result.ok([]);
      expect(errorOf(await service.prepareJide(input())).message).toContain('noch keine Abgaben');
    });

    it('hands on an error of J;DE and keeps no run open', async () => {
      api.handins = Result.fail(new JideApiError('J;DE ist nicht erreichbar.', 0));
      expect(errorOf(await service.prepareJide(input())).message).toBe('J;DE ist nicht erreichbar.');
      api.handins = Result.ok([handin({})]);
      valueOf(await service.prepareJide(input()));
    });

    it('is refused while another run is open and without a J;DE connection', async () => {
      await prepared();
      expect(errorOf(await service.prepareJide(input())).message).toContain('still open');
      withJide = false;
      expect(errorOf(await createService().prepareJide(input())).message).toBe('J;DE ist nicht eingerichtet.');
    });
  });

  describe('confirm', () => {
    it('builds the workspace from the package and the hand-ins of the matched students', async () => {
      const runId = await prepared();
      const confirmedRun = valueOf(await service.confirm(runId, []));
      expect(confirmedRun.handinCount).toBe(2);
      expect(builder.last?.handins.map((h) => h.studentId)).toEqual(['s-max', 's-anna']);
      const root = builder.roots[0] as string;
      expect(await fs.readFile(path.join(root, 'assignment', 'aufgabe.md'), 'utf8')).toBe('# Summe\n');
      const text = await fs.readFile(path.join(root, 'handins', builder.token('s-max'), 'Summe.java'), 'utf8');
      expect(text).toContain('STUDENT');
      expect(text).not.toContain('Mustermann');
      expect(await fs.readFile(path.join(root, 'OUTPUT_SCHEMA.md'), 'utf8')).toContain('lineComments');
      expect(confirmedRun.report.find((r) => r.studentId === 's-max')).toMatchObject({ path: 'Summe.java', replacements: 1 });
    });

    it('does not allow assigning hand-ins by hand', async () => {
      const runId = await prepared();
      expect(errorOf(await service.confirm(runId, [{ moodleId: '503', studentId: 's-zoe' }])).message).toContain('cannot be assigned by hand');
    });

    it('fails without leaving a workspace when the package is broken', async () => {
      api.packageZip = Result.ok(new Uint8Array([1, 2, 3]));
      const runId = await prepared();
      expect(errorOf(await service.confirm(runId, [])).message).toBe('Das Aufgabenpaket ist ungültig.');
      expect(builder.roots).toEqual([]);
    });
  });

  describe('start', () => {
    it('asks for du-comments with line comments and returns the review with the original code', async () => {
      const runId = await confirmed();
      runner.respond = () => output([{ path: 'Summe.java', line: 2, text: 'Hier könntest du `x` verwenden.' }]);
      const result = valueOf(await service.start(runId, () => undefined));

      const request = runner.requests[0] as AgentRunRequest;
      expect(request.prompt).toContain('"du"');
      expect(request.prompt).toContain('assignment/');
      expect(JSON.stringify(request.jsonSchema)).toContain('lineComments');
      expect(result.source).toBe('jide');
      const max = result.rows.find((r) => r.studentId === 's-max');
      expect(max).toMatchObject({
        proposal: { symbol: 'PLUS' },
        comment: 'Du hast das gut gelöst.',
        flags: [],
        jide: {
          files: [{ path: 'Summe.java', content: 'class Summe {\n  int x;\n  // Max Mustermann\n}\n' }],
          lineComments: [{ path: 'Summe.java', line: 2, text: 'Hier könntest du `x` verwenden.' }],
          submittedAt: '2026-11-10T09:00:00Z',
          late: false,
          testsPassed: 1,
          testsTotal: 2,
          graded: false,
        },
      });
    });

    it('drops line comments for lines that do not exist and flags the row', async () => {
      const runId = await confirmed();
      runner.respond = () => output([{ path: 'Summe.java', line: 40, text: 'x' }, { path: 'Nope.java', line: 1, text: 'y' }]);
      const result = valueOf(await service.start(runId, () => undefined));
      const max = result.rows.find((r) => r.studentId === 's-max');
      expect(max?.jide?.lineComments).toEqual([]);
      expect(max?.flags).toEqual(['LINE_COMMENT_DROPPED']);
    });

    it('shows no excluded file and takes no comment on it', async () => {
      const runId = await confirmed();
      valueOf(await service.excludeFiles(runId, [{ studentId: 's-max', path: 'Summe.java' }]));
      runner.respond = () => output([{ path: 'Summe.java', line: 1, text: 'x' }]);
      const result = valueOf(await service.start(runId, () => undefined));
      const max = result.rows.find((r) => r.studentId === 's-max');
      expect(max?.jide?.files).toEqual([]);
      expect(max?.flags).toEqual(['LINE_COMMENT_DROPPED']);
    });
  });

  describe('save', () => {
    const noteOf = (performanceId: string): string[] =>
      (
        fixture.db
          .prepare("SELECT text_content FROM findings WHERE student_performance_id = ? AND type = 'note' AND deleted_at IS NULL")
          .all(performanceId) as { text_content: string }[]
      ).map((r) => r.text_content);

    it('saves the symbol and the overall comment in Grader and sends the grade with its line comments to J;DE', async () => {
      const runId = await proposed();
      const lineComments = [{ path: 'Summe.java', line: 2, text: 'Gut.' }];
      const result = valueOf(await service.save(runId, rows({ lineComments }), false));

      expect(result).toEqual({ saved: 1, failed: [], jide: [{ studentId: 's-max', status: 'sent', message: null }] });
      expect(api.puts).toEqual([{ handinId: '501', grade: { symbol: 'PLUS', comment: 'Gut.', lineComments } }]);
      const stored = await gradingService.getPerformancesByAssessment(fixture.tertiaryId);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ studentId: 's-max', symbol: 'PLUS' });
      expect(noteOf((stored[0] as { id: string }).id)).toEqual(['Gut.']);
      expect(builder.roots.length).toBe(1);
      await expect(fs.stat(builder.roots[0] as string)).rejects.toThrow();
    });

    it('marks a row J;DE rejects with NEWER_HANDIN, still saves it in Grader and does not retry it', async () => {
      const runId = await proposed();
      api.put = (handinId) =>
        handinId === '501'
          ? Result.fail(new JideApiError('Es gibt eine neuere Abgabe.', 409, 'NEWER_HANDIN'))
          : Result.ok({ gradedAt: 'x' });
      const result = valueOf(
        await service.save(runId, rows({}, { studentId: 's-anna', symbol: 'WELLE', comment: 'Ok.' }), false),
      );
      expect(result.saved).toBe(2);
      expect(result.jide).toEqual([
        { studentId: 's-max', status: 'newer-handin', message: 'neue Abgabe seit dem Laden' },
        { studentId: 's-anna', status: 'sent', message: null },
      ]);
      // Nothing left to retry: the run is closed.
      expect(errorOf(await service.save(runId, rows({}), false)).name).toBe('NotFoundError');
    });

    it('shows the server message of another error per row and keeps the run for a retry', async () => {
      const runId = await proposed();
      let fail = true;
      api.put = () => (fail ? Result.fail(new JideApiError('Die Aufgabe ist gesperrt.', 409, 'GRADED')) : Result.ok({ gradedAt: 'x' }));
      const first = valueOf(await service.save(runId, rows({}), false));
      expect(first.saved).toBe(1);
      expect(first.jide).toEqual([{ studentId: 's-max', status: 'error', message: 'Die Aufgabe ist gesperrt.' }]);

      fail = false;
      // The retry sends only: no question about replacing the result that was just saved.
      const retry = valueOf(await service.save(runId, rows({ skipGrader: true }), false));
      expect(retry).toEqual({ saved: 0, failed: [], jide: [{ studentId: 's-max', status: 'sent', message: null }] });
      expect(await gradingService.getPerformancesByAssessment(fixture.tertiaryId)).toHaveLength(1);
    });

    it('asks to confirm replacing results before anything is written or sent', async () => {
      valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: fixture.tertiaryId, symbol: 'MINUS' }));
      const runId = await proposed();
      const error = errorOf(await service.save(runId, rows({}), false));
      expect(error).toBeInstanceOf(OverwriteNeedsConfirmationError);
      expect(api.puts).toEqual([]);
      valueOf(await service.save(runId, rows({}), true));
      expect(api.puts).toHaveLength(1);
    });

    it('sends only rows that are included and not yet sent', async () => {
      const runId = await proposed();
      valueOf(
        await service.save(runId, rows({ include: false }, { studentId: 's-anna', symbol: 'WELLE', skipJide: true }), false),
      );
      expect(api.puts).toEqual([]);
    });

    it('does not send an invalid line comment and reports it for that row only', async () => {
      const runId = await proposed();
      const result = valueOf(
        await service.save(
          runId,
          rows({ lineComments: [{ path: 'Other.java', line: 1, text: 'x' }] }, { studentId: 's-anna', symbol: 'WELLE' }),
          false,
        ),
      );
      expect(result.saved).toBe(2);
      expect(result.jide?.[0]).toMatchObject({ studentId: 's-max', status: 'error' });
      expect(result.jide?.[0]?.message).toContain('Zeilenkommentar');
      expect(result.jide?.[1]).toMatchObject({ studentId: 's-anna', status: 'sent' });
      expect(api.puts.map((p) => p.handinId)).toEqual(['502']);
    });

    it('drops an emptied line comment instead of sending it', async () => {
      const runId = await proposed();
      valueOf(await service.save(runId, rows({ lineComments: [{ path: 'Summe.java', line: 1, text: '   ' }] }), false));
      expect(api.puts[0]?.grade.lineComments).toEqual([]);
    });

    it('reports both sides separately when both fail, and does not lose the row', async () => {
      const runId = await proposed();
      const result = valueOf(await service.save(runId, rows({ comment: 'x'.repeat(2001) }), false));
      expect(result.saved).toBe(0);
      expect(result.failed).toEqual([{ studentId: 's-max', message: 'Comment is too long' }]);
      expect(result.jide).toEqual([{ studentId: 's-max', status: 'error', message: 'Der Kommentar ist zu lang.' }]);
      // Still open for a retry.
      expect(valueOf(await service.save(runId, rows({}), false)).saved).toBe(1);
    });

    it('reports every row as failed when J;DE cannot be reached, and Grader still saves', async () => {
      const runId = await proposed();
      overrides = {};
      api.put = () => Result.fail(new JideApiError('J;DE ist nicht erreichbar.', 0));
      const result = valueOf(await service.save(runId, rows({}), false));
      expect(result.saved).toBe(1);
      expect(result.jide).toEqual([{ studentId: 's-max', status: 'error', message: 'J;DE ist nicht erreichbar.' }]);
    });

    it('sends nothing when no row is included', async () => {
      const runId = await proposed();
      const result = valueOf(await service.save(runId, rows({ include: false }), false));
      expect(result.jide).toEqual([]);
    });
  });
});
