import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import type { Db } from '../../../src/infrastructure/persistence/db';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SqliteFindingRepository } from '../../../src/infrastructure/persistence/SqliteFindingRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteUnitOfWork } from '../../../src/infrastructure/persistence/SqliteUnitOfWork';
import { AssessmentService } from '../../../src/application/AssessmentService';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { FindingService } from '../../../src/application/FindingService';
import { GradeflowService } from '../../../src/application/GradeflowService';
import { OverwriteNeedsConfirmationError } from '../../../src/application/GradeflowSaver';
import type {
  GradeflowDeps,
  GradeflowProgressDto,
  PrepareInput,
  SaveRow,
} from '../../../src/application/GradeflowTypes';
import type { MaterialKind } from '../../../src/domain/gradeflow/WorkspaceMaterial';
import { GradingService } from '../../../src/application/GradingService';
import { SessionService } from '../../../src/application/SessionService';
import {
  AgentProgress,
  AgentRunError,
  AgentRunOutcome,
  AgentRunRequest,
  AgentRunner,
} from '../../../src/domain/gradeflow/AgentRunner';
import { HandinDirectory } from '../../../src/domain/gradeflow/HandinDirectory';
import {
  BuildWorkspaceInput,
  BuiltWorkspace,
  HandinWorkspaceBuilder,
  WorkspaceReportEntry,
} from '../../../src/domain/gradeflow/HandinWorkspaceBuilder';
import { SkillCatalog, SkillListing } from '../../../src/domain/gradeflow/SkillCatalog';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { Course } from '../../../src/domain/grade/Course';
import { GradingType } from '../../../src/domain/grade/GradingType';
import { Result } from '../../../src/domain/shared/Result';
import { Name } from '../../../src/domain/student/Name';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';

const MAX_FOLDER = 'Max Mustermann_111_assignsubmission_file_';
const ANNA_FOLDER = 'Anna Bauer_222_assignsubmission_file_';
const STRANGER_FOLDER = 'Hans Fremd_333_assignsubmission_file_';

const valueOf = <T>(result: Result<T, Error>): T => {
  if (!result.ok) throw result.error;
  return result.value;
};
const errorOf = <T>(result: Result<T, Error>): Error => {
  if (result.ok) throw new Error('expected a failure');
  return result.error;
};

class FakeDirectory implements HandinDirectory {
  folders: string[] = [MAX_FOLDER, ANNA_FOLDER, STRANGER_FOLDER, 'readme'];
  kinds = new Map<string, MaterialKind>([
    ['/in/assignment.pdf', 'file'],
    ['/in/solution.pdf', 'file'],
    ['/in/assignment-dir', 'directory'],
    ['/in/solution-dir', 'directory'],
  ]);
  unreadable = false;
  async listFolderNames(): Promise<Result<string[]>> {
    return this.unreadable ? Result.fail(new ValidationError('unreadable')) : Result.ok(this.folders);
  }
  async kindOf(path: string): Promise<MaterialKind | null> {
    return this.kinds.get(path) ?? null;
  }
}

class FakeBuilder implements HandinWorkspaceBuilder {
  inputs: BuildWorkspaceInput[] = [];
  removed: { root: string; token: string; paths: string[] }[] = [];
  cleaned: string[] = [];
  buildFails = false;
  removeFails = false;
  private counter = 0;
  reportFor = (input: BuildWorkspaceInput): WorkspaceReportEntry[] =>
    input.handins.map((handin) => ({
      token: input.pseudonyms.tokenOf(handin.studentId) ?? '',
      path: 'Main.java',
      kind: 'text',
      replacements: 2,
      loneNameHits: [{ name: 'max', count: 1 }],
    }));
  async build(input: BuildWorkspaceInput): Promise<Result<BuiltWorkspace>> {
    if (this.buildFails) return Result.fail(new ValidationError('build failed'));
    this.inputs.push(input);
    this.counter += 1;
    return Result.ok({ root: `/ws/${this.counter}`, report: this.reportFor(input) });
  }
  async removeFiles(root: string, token: string, paths: string[]): Promise<Result<void>> {
    if (this.removeFails) return Result.fail(new ValidationError('remove failed'));
    this.removed.push({ root, token, paths });
    return Result.ok(undefined as void);
  }
  async cleanup(root: string): Promise<Result<void>> {
    this.cleaned.push(root);
    return Result.ok(undefined as void);
  }
  lastTokens(): Record<string, string> {
    const input = this.inputs[this.inputs.length - 1];
    if (!input) throw new Error('nothing built');
    return Object.fromEntries(input.handins.map((h) => [h.studentId, input.pseudonyms.tokenOf(h.studentId) ?? '']));
  }
}

class FakeRunner implements AgentRunner {
  requests: AgentRunRequest[] = [];
  respond: (tokens: Record<string, string>) => Result<AgentRunOutcome, AgentRunError> = () => {
    throw new Error('no response configured');
  };
  progress: AgentProgress[] = [];
  waitForAbort = false;
  constructor(private readonly tokens: () => Record<string, string>) {}
  async run(
    request: AgentRunRequest,
    onProgress: (event: AgentProgress) => void,
    signal: AbortSignal,
  ): Promise<Result<AgentRunOutcome, AgentRunError>> {
    this.requests.push(request);
    this.progress.forEach(onProgress);
    if (this.waitForAbort) {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
      return Result.fail(new AgentRunError('CANCELLED', 'The run was cancelled'));
    }
    return this.respond(this.tokens());
  }
}

const outcome = (structuredOutput: unknown): Result<AgentRunOutcome, AgentRunError> =>
  Result.ok({ structuredOutput, costUsd: 0.42, durationMs: 1234, turns: 5, permissionDenials: 0 });

describe('GradeflowService', () => {
  let db: Db;
  let directory: FakeDirectory;
  let builder: FakeBuilder;
  let runner: FakeRunner;
  let listing: SkillListing;
  let skillDirs: Record<string, string>;
  let debugLines: string[];
  let service: GradeflowService;
  let gradingService: GradingService;
  let findingService: FindingService;
  let sessionId: string;
  let tertiaryId: string;
  let numericId: string;
  let numericNoMaxId: string;
  let impromptuId: string;
  let otherCourseAssessmentId: string;
  let counter: number;
  let overrides: Partial<GradeflowDeps>;

  const createService = (): GradeflowService => {
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    const assessmentRepo = new SqliteAssessmentRepository(db);
    const rosterService = new CourseRosterService(courseRepo, studentRepo, new SqliteCourseRosterRepository(db));
    gradingService = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, assessmentRepo, sessionRepo);
    findingService = new FindingService(new SqliteFindingRepository(db), new SqliteUnitOfWork(db));
    return new GradeflowService({
      rosterService,
      sessionService: new SessionService(sessionRepo, courseRepo, studentRepo, rosterService),
      assessmentService: new AssessmentService(assessmentRepo, sessionRepo, courseRepo),
      gradingService,
      findingService,
      workspaceBuilder: builder,
      handinDirectory: directory,
      skillCatalog: {
        list: async () => listing,
        dirOf: async (id) => skillDirs[id] ?? null,
      } satisfies SkillCatalog,
      agentRunner: runner,
      randomIndex: () => {
        counter += 1;
        return counter % 36;
      },
      settings: () => ({ maxBudgetUsd: 2, timeoutMs: 60_000 }),
      debug: (line) => debugLines.push(line),
      ...overrides,
    });
  };

  const input = (patch: Partial<PrepareInput> = {}): PrepareInput => ({
    courseId: 'course-1',
    assessmentId: tertiaryId,
    handinsDir: '/in/handins',
    assignmentPath: '/in/assignment.pdf',
    solutionPath: '/in/solution.pdf',
    skillId: 'beginner',
    ...patch,
  });

  const prepared = async (patch: Partial<PrepareInput> = {}): Promise<string> =>
    valueOf(await service.prepare(input(patch))).runId;

  const confirmed = async (patch: Partial<PrepareInput> = {}): Promise<string> => {
    const runId = await prepared(patch);
    valueOf(await service.confirm(runId, []));
    return runId;
  };

  const tertiaryOutput = (tokens: Record<string, string>, comment = 'Gut gemacht'): unknown => ({
    version: 1,
    results: [
      { token: tokens['s-max'], symbol: 'PLUS', comment },
      { token: tokens['s-anna'], symbol: 'MINUS', comment: 'Luft nach oben' },
    ],
  });

  const proposed = async (): Promise<string> => {
    const runId = await confirmed();
    runner.respond = (tokens) => outcome(tertiaryOutput(tokens));
    valueOf(await service.start(runId, () => undefined));
    return runId;
  };

  const rowsOf = (...entries: Partial<SaveRow>[]): SaveRow[] =>
    entries.map((entry) => ({ studentId: 's-max', comment: '', include: true, ...entry }));

  const notesOf = (performanceId: string): string[] =>
    (
      db
        .prepare(
          "SELECT text_content FROM findings WHERE student_performance_id = ? AND type = 'note' AND deleted_at IS NULL",
        )
        .all(performanceId) as { text_content: string }[]
    ).map((row) => row.text_content);

  beforeEach(async () => {
    db = createInMemoryDb();
    runMigrations(db);
    counter = 0;
    overrides = {};
    debugLines = [];
    directory = new FakeDirectory();
    builder = new FakeBuilder();
    runner = new FakeRunner(() => builder.lastTokens());
    listing = {
      skills: [
        { id: 'beginner', name: 'Beginner', description: 'Strict on basics', model: null, source: 'bundled' },
        { id: 'expert', name: 'Expert', description: 'Deep review', model: 'opus', source: 'user' },
      ],
      invalid: [{ id: 'broken', reason: 'SKILL.md needs a frontmatter block (---)' }],
    };
    skillDirs = { beginner: '/skills/beginner', expert: '/skills/expert' };

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const year = SchoolYear.create('2026/27');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);
    const course = Course.create('course-1', 'Informatik', schoolClass);
    course.addAssessmentCategory(new AssessmentCategory('cat-test', 'Test', GradingType.NUMERIC, true));
    courseRepo.save(course);
    courseRepo.save(Course.create('course-2', 'Physik', schoolClass));
    const mitarbeitId = course.getMitarbeitCategory()!.id;

    for (const [id, first, last] of [
      ['s-max', 'Max', 'Mustermann'],
      ['s-anna', 'Anna', 'Bauer'],
      ['s-zoe', 'Zoe', 'Zorn'],
    ] as const) {
      const sid = StudentId.create(id);
      const name = Name.create(first, last);
      if (!sid.ok || !name.ok) throw new Error('fixture');
      studentRepo.save(Student.create(sid.value, name.value, schoolClass));
    }

    const sessionRepo = new SqliteSessionRepository(db);
    const rosterService = new CourseRosterService(courseRepo, studentRepo, new SqliteCourseRosterRepository(db));
    const sessions = new SessionService(sessionRepo, courseRepo, studentRepo, rosterService);
    const assessments = new AssessmentService(new SqliteAssessmentRepository(db), sessionRepo, courseRepo);
    sessionId = valueOf(await sessions.create({ courseId: 'course-1', date: '2026-10-12' })).id;
    const other = valueOf(await sessions.create({ courseId: 'course-2', date: '2026-10-12' })).id;
    const make = async (title: string, categoryId: string, extra: object = {}, courseId = 'course-1', session = sessionId) =>
      valueOf(await assessments.create({ sessionId: session, title, categoryId, courseId, isImpromptu: false, ...extra })).id;
    tertiaryId = await make('Mitarbeit', mitarbeitId);
    numericId = await make('Test 1', 'cat-test', { maxPoints: 20 });
    numericNoMaxId = await make('Test 2', 'cat-test');
    impromptuId = await make('Stegreif', mitarbeitId, { isImpromptu: true });
    const course2Mitarbeit = (await courseRepo.findById('course-2'))!.getMitarbeitCategory()!.id;
    otherCourseAssessmentId = await make('Fremd', course2Mitarbeit, {}, 'course-2', other);

    service = createService();
  });

  afterEach(() => {
    db.close();
  });

  describe('listSkills', () => {
    it('lists valid and invalid skills as plain dtos', async () => {
      expect(await service.listSkills()).toEqual({
        skills: [
          { id: 'beginner', name: 'Beginner', description: 'Strict on basics', model: null, source: 'bundled' },
          { id: 'expert', name: 'Expert', description: 'Deep review', model: 'opus', source: 'user' },
        ],
        invalid: [{ id: 'broken', reason: 'SKILL.md needs a frontmatter block (---)' }],
      });
    });
  });

  describe('prepare', () => {
    it('matches hand-in folders against all students of the course', async () => {
      const run = valueOf(await service.prepare(input()));

      expect(run.runId).toEqual(expect.any(String));
      expect(run.unrecognised).toEqual(['readme']);
      expect(run.studentsWithoutHandin).toEqual(['s-zoe']);
      expect(run.conflicts).toEqual([]);
      expect(run.students.map((s) => s.id).sort()).toEqual(['s-anna', 's-max', 's-zoe']);
      expect(run.entries).toEqual([
        { moodleId: '111', fullName: 'Max Mustermann', alternativeNames: [], status: 'matched', studentId: 's-max', candidateIds: [] },
        { moodleId: '222', fullName: 'Anna Bauer', alternativeNames: [], status: 'matched', studentId: 's-anna', candidateIds: [] },
        { moodleId: '333', fullName: 'Hans Fremd', alternativeNames: [], status: 'unmatched', studentId: null, candidateIds: [] },
      ]);
    });

    it('reports candidates of ambiguous hand-ins', async () => {
      directory.folders = ['Max Mustermann_111_assignsubmission_file_', 'Max Mustermann_444_assignsubmission_file_'];

      const run = valueOf(await service.prepare(input()));

      expect(run.entries.map((e) => [e.moodleId, e.status, e.studentId, e.candidateIds])).toEqual([
        ['111', 'ambiguous', null, ['s-max']],
        ['444', 'ambiguous', null, ['s-max']],
      ]);
      expect(run.conflicts).toEqual([{ studentId: 's-max', moodleIds: ['111', '444'] }]);
    });

    it('accepts a numeric assessment with maxPoints and no solution file', async () => {
      const result = await service.prepare(input({ assessmentId: numericId, solutionPath: null }));

      expect(result.ok).toBe(true);
    });

    it('fails for an unknown course', async () => {
      expect(errorOf(await service.prepare(input({ courseId: 'nope' })))).toBeInstanceOf(NotFoundError);
    });

    it('fails for an assessment that is not in the course', async () => {
      expect(errorOf(await service.prepare(input({ assessmentId: otherCourseAssessmentId })))).toBeInstanceOf(NotFoundError);
      expect(errorOf(await service.prepare(input({ assessmentId: 'nope' })))).toBeInstanceOf(NotFoundError);
    });

    it('refuses impromptu assessments', async () => {
      expect(errorOf(await service.prepare(input({ assessmentId: impromptuId })))).toBeInstanceOf(ValidationError);
    });

    it('refuses a numeric assessment without maxPoints', async () => {
      expect(errorOf(await service.prepare(input({ assessmentId: numericNoMaxId })))).toBeInstanceOf(ValidationError);
    });

    it('refuses unknown and invalid skills', async () => {
      expect(errorOf(await service.prepare(input({ skillId: 'nope' })))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.prepare(input({ skillId: 'broken' })))).toBeInstanceOf(ValidationError);
    });

    it('refuses a listed skill whose directory is gone', async () => {
      delete skillDirs.beginner;

      expect(errorOf(await service.prepare(input()))).toBeInstanceOf(ValidationError);
    });

    it('refuses relative paths', async () => {
      expect(errorOf(await service.prepare(input({ handinsDir: 'handins' })))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.prepare(input({ assignmentPath: 'a.pdf' })))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.prepare(input({ solutionPath: 's.pdf' })))).toBeInstanceOf(ValidationError);
    });

    it('refuses a missing assignment and a missing solution', async () => {
      const noAssignment = errorOf(await service.prepare(input({ assignmentPath: '/in/none.pdf' })));
      expect(noAssignment).toBeInstanceOf(ValidationError);
      expect(noAssignment.message).toBe('The assignment does not exist');
      const noSolution = errorOf(await service.prepare(input({ solutionPath: '/in/none.pdf' })));
      expect(noSolution).toBeInstanceOf(ValidationError);
      expect(noSolution.message).toBe('The solution does not exist');
    });

    it('accepts folders for the assignment and the solution', async () => {
      const result = await service.prepare(
        input({ assignmentPath: '/in/assignment-dir', solutionPath: '/in/solution-dir' }),
      );

      expect(result.ok).toBe(true);
    });

    it('refuses a missing assignment folder', async () => {
      const error = errorOf(await service.prepare(input({ assignmentPath: '/in/none-dir' })));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('The assignment does not exist');
    });

    it('fails when the hand-ins folder cannot be read', async () => {
      directory.unreadable = true;

      expect(errorOf(await service.prepare(input()))).toBeInstanceOf(ValidationError);
    });

    it('allows only one active run at a time', async () => {
      const runId = await prepared();

      expect(errorOf(await service.prepare(input()))).toBeInstanceOf(ValidationError);

      await service.discard(runId);
      expect((await service.prepare(input())).ok).toBe(true);
    });

    it('does not block a new run after a refused preparation', async () => {
      await service.prepare(input({ skillId: 'nope' }));

      expect((await service.prepare(input())).ok).toBe(true);
    });
  });

  describe('confirm', () => {
    it('builds a pseudonymised workspace for the matched hand-ins', async () => {
      const runId = await prepared();

      const result = valueOf(await service.confirm(runId, []));

      const built = builder.inputs[0]!;
      expect(built.handinsDir).toBe('/in/handins');
      expect(built.assignmentPath).toBe('/in/assignment.pdf');
      expect(built.solutionPath).toBe('/in/solution.pdf');
      expect(built.assignmentKind).toBe('file');
      expect(built.solutionKind).toBe('file');
      expect(built.skill).toEqual({ id: 'beginner', dir: '/skills/beginner' });
      expect(built.handins.map((h) => [h.studentId, h.folders])).toEqual([
        ['s-max', [MAX_FOLDER]],
        ['s-anna', [ANNA_FOLDER]],
      ]);
      expect(built.pseudonyms.size).toBe(2);
      expect(built.students.map((s) => `${s.firstName} ${s.lastName}`).sort()).toEqual([
        'Anna Bauer',
        'Max Mustermann',
        'Zoe Zorn',
      ]);
      expect(result.handinCount).toBe(2);
      for (const token of built.pseudonyms.tokens()) expect(built.outputInstructions).toContain(token);
    });

    it('maps the report from tokens to student ids and never exposes a token', async () => {
      const runId = await prepared();
      builder.reportFor = (build) => [
        {
          token: build.pseudonyms.tokenOf('s-max') ?? '',
          path: 'src/Main.java',
          kind: 'text',
          replacements: 3,
          loneNameHits: [{ name: 'Mustermann', count: 2 }],
        },
        { token: build.pseudonyms.tokenOf('s-anna') ?? '', path: 'doc.pdf', kind: 'binary', detail: 'cannot scrub' },
        { token: 'unknowntoken', path: 'x', kind: 'text' },
      ];

      const result = valueOf(await service.confirm(runId, []));

      expect(result.report).toEqual([
        { studentId: 's-max', path: 'src/Main.java', kind: 'text', replacements: 3, loneNameHits: [{ name: 'Mustermann', count: 2 }], detail: null },
        { studentId: 's-anna', path: 'doc.pdf', kind: 'binary', replacements: 0, loneNameHits: [], detail: 'cannot scrub' },
      ]);
      for (const token of builder.inputs[0]!.pseudonyms.tokens()) {
        expect(JSON.stringify(result)).not.toContain(token);
      }
    });

    it('applies the teacher overrides', async () => {
      const runId = await prepared();

      valueOf(
        await service.confirm(runId, [
          { moodleId: '333', studentId: 's-zoe' },
          { moodleId: '222', studentId: null },
        ]),
      );

      expect(builder.inputs[0]!.handins.map((h) => [h.moodleId, h.studentId])).toEqual([
        ['111', 's-max'],
        ['333', 's-zoe'],
      ]);
    });

    it('rejects invalid overrides', async () => {
      const runId = await prepared();

      expect(errorOf(await service.confirm(runId, [{ moodleId: '999', studentId: null }]))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.confirm(runId, [{ moodleId: '333', studentId: 'nope' }]))).toBeInstanceOf(ValidationError);
      expect(builder.inputs).toHaveLength(0);
    });

    it('needs at least one confirmed hand-in', async () => {
      const runId = await prepared();

      const result = await service.confirm(runId, [
        { moodleId: '111', studentId: null },
        { moodleId: '222', studentId: null },
      ]);

      expect(errorOf(result)).toBeInstanceOf(ValidationError);
    });

    it('fails for an unknown run', async () => {
      expect(errorOf(await service.confirm('nope', []))).toBeInstanceOf(NotFoundError);
    });

    it('passes a failing build on and keeps the run', async () => {
      const runId = await prepared();
      builder.buildFails = true;
      expect(errorOf(await service.confirm(runId, []))).toBeInstanceOf(ValidationError);

      builder.buildFails = false;
      expect((await service.confirm(runId, [])).ok).toBe(true);
    });

    it('fails when the random source cannot give unique tokens', async () => {
      overrides = { randomIndex: () => 0 };
      service = createService();
      const runId = await prepared();

      expect(errorOf(await service.confirm(runId, []))).toBeInstanceOf(ValidationError);
      expect(builder.inputs).toHaveLength(0);
    });

    it('replaces the workspace of an earlier confirmation', async () => {
      const runId = await prepared();
      valueOf(await service.confirm(runId, []));

      valueOf(await service.confirm(runId, [{ moodleId: '222', studentId: null }]));

      expect(builder.cleaned).toEqual(['/ws/1']);
      expect(builder.inputs).toHaveLength(2);
    });

    it('is refused while the agent runs', async () => {
      const runId = await confirmed();
      runner.waitForAbort = true;
      const running = service.start(runId, () => undefined);
      await Promise.resolve();
      await Promise.resolve();

      expect(errorOf(await service.confirm(runId, []))).toBeInstanceOf(ValidationError);

      await service.cancel(runId);
      await running;
    });
  });

  describe('excludeFiles', () => {
    it('removes the files from the matching hand-in workspace folders', async () => {
      const runId = await confirmed();
      const tokens = builder.lastTokens();

      const result = await service.excludeFiles(runId, [
        { studentId: 's-max', path: 'a.bin' },
        { studentId: 's-anna', path: 'b.bin' },
        { studentId: 's-max', path: 'c.bin' },
      ]);

      expect(result.ok).toBe(true);
      expect(builder.removed).toEqual([
        { root: '/ws/1', token: tokens['s-max'], paths: ['a.bin', 'c.bin'] },
        { root: '/ws/1', token: tokens['s-anna'], paths: ['b.bin'] },
      ]);
    });

    it('fails before the workspace exists, for unknown students and failing removal', async () => {
      const runId = await prepared();
      expect(errorOf(await service.excludeFiles(runId, [{ studentId: 's-max', path: 'a' }]))).toBeInstanceOf(ValidationError);

      valueOf(await service.confirm(runId, []));
      expect(errorOf(await service.excludeFiles(runId, [{ studentId: 's-zoe', path: 'a' }]))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.excludeFiles('nope', []))).toBeInstanceOf(NotFoundError);

      builder.removeFails = true;
      expect(errorOf(await service.excludeFiles(runId, [{ studentId: 's-max', path: 'a' }]))).toBeInstanceOf(ValidationError);
    });
  });

  describe('start', () => {
    it('runs the agent and returns one review row per hand-in with the current results', async () => {
      valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: tertiaryId, symbol: 'MINUS' }));
      const existing = valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: tertiaryId, symbol: 'MINUS' }));
      valueOf(await findingService.setNote(existing.id, 'Alter Kommentar'));
      const runId = await confirmed();
      runner.respond = (tokens) => outcome({ version: 1, results: [{ token: tokens['s-max'], symbol: 'PLUS', comment: 'Gut' }] });
      runner.progress = [{ kind: 'started', model: 'sonnet' }, { kind: 'working', turns: 2 }, { kind: 'finished' }];

      const result = valueOf(await service.start(runId, () => undefined));

      expect(result).toEqual({
        rows: [
          {
            studentId: 's-max',
            proposal: { symbol: 'PLUS', score: null },
            comment: 'Gut',
            flags: [],
            current: { symbol: 'MINUS', score: null, note: 'Alter Kommentar' },
          },
          { studentId: 's-anna', proposal: null, comment: '', flags: [], current: null },
        ],
        missingStudentIds: ['s-anna'],
        costUsd: 0.42,
        durationMs: 1234,
      });
    });

    it('configures the run from the skill, the settings and the workspace', async () => {
      const runId = await confirmed();
      runner.respond = (tokens) => outcome(tertiaryOutput(tokens));

      valueOf(await service.start(runId, () => undefined));

      const request = runner.requests[0]!;
      expect(request.workspaceRoot).toBe('/ws/1');
      expect(request.model).toBe('sonnet');
      expect(request.maxBudgetUsd).toBe(2);
      expect(request.timeoutMs).toBe(60_000);
      expect(request.prompt).toContain('"beginner"');
      expect(request.prompt).toContain('ASSIGNMENT.pdf');
      expect(request.prompt).toContain('SOLUTION.pdf');
      expect(request.prompt).toContain('exactly 2 folders');
      expect(JSON.stringify(request.jsonSchema)).toContain('PLUS_WELLE');
    });

    it('hands folder materials to the builder and names them in the prompt', async () => {
      const runId = await confirmed({ assignmentPath: '/in/assignment-dir', solutionPath: '/in/solution-dir' });
      runner.respond = (tokens) => outcome(tertiaryOutput(tokens));

      valueOf(await service.start(runId, () => undefined));

      const built = builder.inputs[0]!;
      expect(built.assignmentKind).toBe('directory');
      expect(built.solutionKind).toBe('directory');
      const prompt = runner.requests[0]!.prompt;
      expect(prompt).toContain('Read every file in assignment/ (the assignment).');
      expect(prompt).toContain('Read every file in solution/ (the sample solution).');
      expect(prompt).not.toContain('ASSIGNMENT');
    });

    it('passes no solution kind when there is no solution', async () => {
      await confirmed({ solutionPath: null });

      expect(builder.inputs[0]!.solutionKind).toBeNull();
    });

    it('uses the model of the skill', async () => {
      const runId = await confirmed({ skillId: 'expert', solutionPath: null });
      runner.respond = (tokens) => outcome(tertiaryOutput(tokens));

      valueOf(await service.start(runId, () => undefined));

      expect(runner.requests[0]!.model).toBe('opus');
      expect(runner.requests[0]!.prompt).not.toContain('SOLUTION');
    });

    it('proposes scores for a numeric assessment', async () => {
      const runId = await confirmed({ assessmentId: numericId });
      runner.respond = (tokens) =>
        outcome({
          version: 1,
          results: [
            { token: tokens['s-max'], score: 17.5, comment: 'ok' },
            { token: tokens['s-anna'], score: 12, comment: 'ok' },
          ],
        });

      const result = valueOf(await service.start(runId, () => undefined));

      expect(result.rows.map((r) => r.proposal)).toEqual([
        { symbol: null, score: 17.5 },
        { symbol: null, score: 12 },
      ]);
    });

    it('maps progress from tokens to student ids', async () => {
      const runId = await confirmed();
      const tokens = builder.lastTokens();
      runner.respond = (t) => outcome(tertiaryOutput(t));
      runner.progress = [
        { kind: 'started', model: 'sonnet' },
        { kind: 'reading', token: tokens['s-anna']! },
        { kind: 'reading', token: 'unknowntoken' },
        { kind: 'working', turns: 3 },
        { kind: 'finished' },
      ];
      const events: GradeflowProgressDto[] = [];

      valueOf(await service.start(runId, (event) => events.push(event)));

      expect(events).toEqual([
        { kind: 'started', model: 'sonnet' },
        { kind: 'reading', studentId: 's-anna' },
        { kind: 'working', turns: 3 },
        { kind: 'finished' },
      ]);
    });

    it('returns the flags of a proposal', async () => {
      const runId = await confirmed();
      runner.respond = (tokens) =>
        outcome({ version: 1, results: [{ token: tokens['s-max'], symbol: 'PLUS', comment: `Super ${tokens['s-anna']} Arbeit` }] });

      const result = valueOf(await service.start(runId, () => undefined));

      expect(result.rows[0]).toMatchObject({ comment: 'Super Arbeit', flags: ['TOKEN_IN_COMMENT'] });
    });

    it('fails with the agent error and keeps the workspace so the run can be retried', async () => {
      const runId = await confirmed();
      runner.respond = () => Result.fail(new AgentRunError('NOT_LOGGED_IN', 'Not signed in'));

      const error = errorOf(await service.start(runId, () => undefined));

      expect(error).toBeInstanceOf(AgentRunError);
      expect((error as AgentRunError).code).toBe('NOT_LOGGED_IN');
      expect(builder.cleaned).toEqual([]);

      runner.respond = (tokens) => outcome(tertiaryOutput(tokens));
      expect((await service.start(runId, () => undefined)).ok).toBe(true);
    });

    it('fails when the agent output is invalid', async () => {
      const runId = await confirmed();
      runner.respond = () => outcome({ version: 1, results: [{ token: 'zzzzzzzz', symbol: 'PLUS', comment: '' }] });

      expect(errorOf(await service.start(runId, () => undefined))).toBeInstanceOf(ValidationError);
      expect(builder.cleaned).toEqual([]);
    });

    it('needs a built workspace', async () => {
      const runId = await prepared();

      expect(errorOf(await service.start(runId, () => undefined))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.start('nope', () => undefined))).toBeInstanceOf(NotFoundError);
    });

    it('refuses a second start while the agent runs, and cancel stops the run', async () => {
      const runId = await confirmed();
      runner.waitForAbort = true;
      const running = service.start(runId, () => undefined);
      await Promise.resolve();
      await Promise.resolve();

      expect(errorOf(await service.start(runId, () => undefined))).toBeInstanceOf(ValidationError);
      expect((await service.cancel(runId)).ok).toBe(true);
      const error = errorOf(await running);

      expect((error as AgentRunError).code).toBe('CANCELLED');
    });

    it('logs numbers only', async () => {
      const runId = await confirmed();
      runner.respond = (tokens) => outcome(tertiaryOutput(tokens));

      valueOf(await service.start(runId, () => undefined));

      expect(debugLines.length).toBeGreaterThan(0);
      for (const line of debugLines) expect(line).toMatch(/^[a-z ]+(: )?([a-zA-Z]+=[\d.]+ ?)*$/);
    });
  });

  describe('cancel', () => {
    it('does nothing when no agent runs, and fails for an unknown run', async () => {
      const runId = await confirmed();

      expect((await service.cancel(runId)).ok).toBe(true);
      expect(errorOf(await service.cancel('nope'))).toBeInstanceOf(NotFoundError);
    });
  });

  describe('save', () => {
    it('saves only the included rows with their comments', async () => {
      const runId = await proposed();

      const result = valueOf(
        await service.save(
          runId,
          rowsOf(
            { studentId: 's-max', symbol: 'PLUS', comment: 'Gut gemacht' },
            { studentId: 's-anna', symbol: 'MINUS', comment: 'nicht gespeichert', include: false },
          ),
          false,
        ),
      );

      expect(result).toEqual({ saved: 1, failed: [] });
      const performances = await gradingService.getPerformancesByAssessment(tertiaryId);
      expect(performances.map((p) => [p.studentId, p.symbol])).toEqual([['s-max', 'PLUS']]);
      expect(notesOf(performances[0]!.id)).toEqual(['Gut gemacht']);
    });

    it('saves scores for a numeric assessment', async () => {
      const runId = await confirmed({ assessmentId: numericId });
      runner.respond = (tokens) =>
        outcome({ version: 1, results: [{ token: tokens['s-max'], score: 17.5, comment: 'x' }, { token: tokens['s-anna'], score: 3, comment: 'y' }] });
      valueOf(await service.start(runId, () => undefined));

      const result = valueOf(await service.save(runId, rowsOf({ score: 17.5, comment: 'x' }), false));

      expect(result.saved).toBe(1);
      expect((await gradingService.getPerformancesByAssessment(numericId))[0]).toMatchObject({ studentId: 's-max', score: 17.5 });
    });

    it('asks for confirmation before it replaces existing results and saves nothing without it', async () => {
      valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: tertiaryId, symbol: 'MINUS' }));
      const runId = await proposed();

      const error = errorOf(await service.save(runId, rowsOf({ symbol: 'PLUS' }, { studentId: 's-anna', symbol: 'PLUS' }), false));

      expect(error).toBeInstanceOf(OverwriteNeedsConfirmationError);
      expect((error as OverwriteNeedsConfirmationError).count).toBe(1);
      expect(error.message).toContain('1');
      const performances = await gradingService.getPerformancesByAssessment(tertiaryId);
      expect(performances.map((p) => [p.studentId, p.symbol])).toEqual([['s-max', 'MINUS']]);
    });

    it('does not ask for existing results of excluded rows', async () => {
      valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: tertiaryId, symbol: 'MINUS' }));
      const runId = await proposed();

      const result = await service.save(runId, rowsOf({ include: false }, { studentId: 's-anna', symbol: 'PLUS' }), false);

      expect(valueOf(result).saved).toBe(1);
    });

    it('replaces results and comments once the teacher confirmed, and a blank comment removes the note', async () => {
      const max = valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: tertiaryId, symbol: 'MINUS' }));
      valueOf(await findingService.setNote(max.id, 'alt'));
      const anna = valueOf(await gradingService.recordPerformance({ studentId: 's-anna', assessmentId: tertiaryId, symbol: 'MINUS' }));
      valueOf(await findingService.setNote(anna.id, 'alt'));
      const runId = await proposed();

      const result = valueOf(
        await service.save(runId, rowsOf({ symbol: 'PLUS', comment: 'neu' }, { studentId: 's-anna', symbol: 'WELLE', comment: '  ' }), true),
      );

      expect(result.saved).toBe(2);
      const performances = await gradingService.getPerformancesByAssessment(tertiaryId);
      expect(performances.map((p) => [p.studentId, p.symbol]).sort()).toEqual([['s-anna', 'WELLE'], ['s-max', 'PLUS']]);
      expect(notesOf(max.id)).toEqual(['neu']);
      expect(notesOf(anna.id)).toEqual([]);
    });

    it('continues after a failing row and reports it', async () => {
      const runId = await proposed();

      const result = valueOf(
        await service.save(
          runId,
          rowsOf(
            { studentId: 's-max', comment: 'kein Ergebnis' },
            { studentId: 's-anna', symbol: 'nonsense' },
            { studentId: 's-anna', symbol: 'PLUS', comment: 'x'.repeat(2001) },
          ),
          false,
        ),
      );

      expect(result.saved).toBe(0);
      expect(result.failed.map((f) => f.studentId)).toEqual(['s-max', 's-anna', 's-anna']);
      expect((await gradingService.getPerformancesByAssessment(tertiaryId))).toEqual([]);
    });

    it('needs a score for a numeric assessment and reports out-of-range scores', async () => {
      const runId = await confirmed({ assessmentId: numericId });
      runner.respond = (tokens) =>
        outcome({ version: 1, results: [{ token: tokens['s-max'], score: 1, comment: '' }, { token: tokens['s-anna'], score: 1, comment: '' }] });
      valueOf(await service.start(runId, () => undefined));

      const result = valueOf(
        await service.save(runId, rowsOf({ studentId: 's-max' }, { studentId: 's-anna', score: 99 }, { studentId: 's-max', score: 5 }), false),
      );

      expect(result.saved).toBe(1);
      expect(result.failed.map((f) => f.studentId)).toEqual(['s-max', 's-anna']);
    });

    it('reports a failing note as a failed row', async () => {
      overrides = {
        findingService: {
          listNotesBySession: (id) => findingService.listNotesBySession(id),
          setNote: async () => Result.fail(new NotFoundError('Performance', 'x')),
        },
      };
      service = createService();
      const runId = await proposed();

      const result = valueOf(await service.save(runId, rowsOf({ symbol: 'PLUS', comment: 'x' }), false));

      expect(result.saved).toBe(0);
      expect(result.failed).toHaveLength(1);
    });

    it('reports an unexpected exception without its message', async () => {
      overrides = {
        gradingService: {
          getPerformancesByAssessment: (id) => gradingService.getPerformancesByAssessment(id),
          recordPerformance: async () => {
            throw new Error('disk full for Max Mustermann');
          },
        },
      };
      service = createService();
      const runId = await proposed();

      const result = valueOf(await service.save(runId, rowsOf({ symbol: 'PLUS' }), false));

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.message).not.toContain('Mustermann');
    });

    it('rejects rows of students that are not part of the run', async () => {
      const runId = await proposed();

      expect(errorOf(await service.save(runId, rowsOf({ studentId: 's-zoe', symbol: 'PLUS' }), false))).toBeInstanceOf(ValidationError);
    });

    it('needs a finished agent run', async () => {
      const runId = await confirmed();

      expect(errorOf(await service.save(runId, [], false))).toBeInstanceOf(ValidationError);
      expect(errorOf(await service.save('nope', [], false))).toBeInstanceOf(NotFoundError);
    });

    it('is refused while the agent runs', async () => {
      const runId = await proposed();
      runner.waitForAbort = true;
      const running = service.start(runId, () => undefined);
      await Promise.resolve();
      await Promise.resolve();

      expect(errorOf(await service.save(runId, [], false))).toBeInstanceOf(ValidationError);

      await service.cancel(runId);
      await running;
    });

    it('cleans up the workspace and drops the run afterwards', async () => {
      const runId = await proposed();

      valueOf(await service.save(runId, rowsOf({ symbol: 'PLUS' }), false));

      expect(builder.cleaned).toEqual(['/ws/1']);
      expect(errorOf(await service.save(runId, [], false))).toBeInstanceOf(NotFoundError);
      expect((await service.prepare(input())).ok).toBe(true);
    });

    describe('after a partial failure', () => {
      const partial = async (): Promise<string> => {
        const runId = await proposed();
        const result = valueOf(
          await service.save(runId, rowsOf({ studentId: 's-max', symbol: 'PLUS' }, { studentId: 's-anna', comment: 'kein Ergebnis' }), false),
        );
        expect(result.failed.map((f) => f.studentId)).toEqual(['s-anna']);
        return runId;
      };

      it('removes the workspace but keeps the run', async () => {
        await partial();

        expect(builder.cleaned).toEqual(['/ws/1']);
        expect(errorOf(await service.prepare(input()))).toBeInstanceOf(ValidationError);
      });

      it('lets the teacher retry the failed rows without a workspace and then drops the run', async () => {
        const runId = await partial();

        const retry = valueOf(await service.save(runId, rowsOf({ studentId: 's-anna', symbol: 'MINUS', comment: 'ok' }), false));

        expect(retry).toEqual({ saved: 1, failed: [] });
        expect(builder.cleaned).toEqual(['/ws/1']);
        expect(errorOf(await service.save(runId, [], false))).toBeInstanceOf(NotFoundError);
        expect((await service.prepare(input())).ok).toBe(true);
      });

      it('keeps the run while a retry still fails', async () => {
        const runId = await partial();

        const retry = valueOf(await service.save(runId, rowsOf({ studentId: 's-anna' }), false));

        expect(retry.failed).toHaveLength(1);
        expect((await service.save(runId, rowsOf({ studentId: 's-anna', symbol: 'PLUS' }), false)).ok).toBe(true);
      });

      it('can be discarded', async () => {
        const runId = await partial();

        expect((await service.discard(runId)).ok).toBe(true);

        expect(builder.cleaned).toEqual(['/ws/1']);
        expect((await service.prepare(input())).ok).toBe(true);
      });
    });

    it('keeps the run when the teacher still has to confirm an overwrite', async () => {
      valueOf(await gradingService.recordPerformance({ studentId: 's-max', assessmentId: tertiaryId, symbol: 'MINUS' }));
      const runId = await proposed();
      await service.save(runId, rowsOf({ symbol: 'PLUS' }), false);

      expect(builder.cleaned).toEqual([]);
      expect((await service.save(runId, rowsOf({ symbol: 'PLUS' }), true)).ok).toBe(true);
    });
  });

  describe('discard', () => {
    it('cleans up and drops the run, also for an unknown run', async () => {
      const runId = await confirmed();

      expect((await service.discard(runId)).ok).toBe(true);
      expect((await service.discard('nope')).ok).toBe(true);

      expect(builder.cleaned).toEqual(['/ws/1']);
      expect(errorOf(await service.confirm(runId, []))).toBeInstanceOf(NotFoundError);
    });

    it('discards a prepared run without a workspace', async () => {
      const runId = await prepared();

      expect((await service.discard(runId)).ok).toBe(true);
      expect(builder.cleaned).toEqual([]);
    });

    it('cancels a running agent first', async () => {
      const runId = await confirmed();
      runner.waitForAbort = true;
      const running = service.start(runId, () => undefined);
      await Promise.resolve();
      await Promise.resolve();

      await service.discard(runId);

      expect((errorOf(await running) as AgentRunError).code).toBe('CANCELLED');
      expect(builder.cleaned).toEqual(['/ws/1']);
    });
  });

  describe('disposeAll', () => {
    it('cleans up the active run', async () => {
      await confirmed();

      await service.disposeAll();

      expect(builder.cleaned).toEqual(['/ws/1']);
      expect((await service.prepare(input())).ok).toBe(true);
    });
  });
});
