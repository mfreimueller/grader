/** Data shapes of the Gradeflow feature, shared by the application layer, the IPC layer and the renderer. */

export type WorkspaceEntryKindDto =
  | 'text'
  | 'binary'
  | 'skipped'
  | 'symlink'
  | 'too-large'
  | 'nested-archive'
  | 'archive-error'
  | 'unsupported-archive';

export interface SkillDto {
  id: string;
  name: string;
  description: string;
  model: 'sonnet' | 'opus' | null;
  source: 'bundled' | 'user';
}

export interface SkillListDto {
  skills: SkillDto[];
  invalid: { id: string; reason: string }[];
}

/** A J;DE run: the exercise comes from the linked J;DE course, the hand-ins from J;DE. */
export interface PrepareJideInput {
  courseId: string;
  assessmentId: string;
  jideExerciseId: string;
  skillId: string;
}

export interface PrepareInput {
  courseId: string;
  assessmentId: string;
  handinsDir: string;
  assignmentPath: string;
  solutionPath: string | null;
  skillId: string;
}

export interface HandinEntryDto {
  moodleId: string;
  fullName: string;
  alternativeNames: string[];
  status: 'matched' | 'ambiguous' | 'unmatched';
  studentId: string | null;
  candidateIds: string[];
}

export interface PreparedRunDto {
  runId: string;
  source: 'moodle' | 'jide';
  /** The J;DE exercise of a J;DE run. */
  exercise: { title: string; slug: string } | null;
  entries: HandinEntryDto[];
  unrecognised: string[];
  studentsWithoutHandin: string[];
  conflicts: { studentId: string; moodleIds: string[] }[];
  students: { id: string; firstName: string; lastName: string }[];
}

export interface MatchOverride {
  moodleId: string;
  studentId: string | null;
}

export interface PreflightEntryDto {
  studentId: string;
  path: string;
  kind: WorkspaceEntryKindDto;
  replacements: number;
  loneNameHits: { name: string; count: number }[];
  detail: string | null;
}

export interface ConfirmedRunDto {
  handinCount: number;
  report: PreflightEntryDto[];
}

export type GradeflowProgressDto =
  | { kind: 'started'; model: 'sonnet' | 'opus' }
  | { kind: 'reading'; studentId: string }
  | { kind: 'working'; turns: number }
  | { kind: 'finished' };

export interface CurrentResultDto {
  symbol: string | null;
  score: number | null;
  note: string | null;
}

export type ReviewFlag = 'TOKEN_IN_COMMENT' | 'COMMENT_TRUNCATED' | 'LINE_COMMENT_DROPPED';

export interface LineCommentDto {
  /** Path of the file in the hand-in, as J;DE knows it. */
  path: string;
  /** 1-based. */
  line: number;
  text: string;
}

/** What the review of a J;DE hand-in shows besides the symbol and the overall comment. */
export interface JideReviewDto {
  /** The files the agent saw (without those the teacher excluded), with their original content. */
  files: { path: string; content: string }[];
  lineComments: LineCommentDto[];
  submittedAt: string | null;
  late: boolean;
  testsPassed: number | null;
  testsTotal: number | null;
  /** J;DE has a grade for this hand-in already; saving replaces it. */
  graded: boolean;
}

export interface ReviewRowDto {
  studentId: string;
  proposal: { symbol: string | null; score: number | null } | null;
  comment: string;
  flags: ReviewFlag[];
  current: CurrentResultDto | null;
  /** J;DE runs only. */
  jide?: JideReviewDto;
}

export interface ProposalsDto {
  source: 'moodle' | 'jide';
  rows: ReviewRowDto[];
  missingStudentIds: string[];
  costUsd: number | null;
  durationMs: number;
}

export interface SaveRow {
  studentId: string;
  symbol?: string | undefined;
  score?: number | undefined;
  comment: string;
  include: boolean;
  /** J;DE runs: the line comments to send. */
  lineComments?: LineCommentDto[] | undefined;
  /** J;DE runs, retry of a row that is saved in Grader already: only send it to J;DE. */
  skipGrader?: boolean | undefined;
  /** J;DE runs, retry of a row that was sent already: only save it in Grader. */
  skipJide?: boolean | undefined;
}

/** How sending one row to J;DE went. `newer-handin`: the student handed in again; the row was not sent. */
export interface JideSendDto {
  studentId: string;
  status: 'sent' | 'newer-handin' | 'error';
  /** The server's message for `error`; null otherwise. */
  message: string | null;
}

export interface SaveResultDto {
  /** Rows saved in Grader. */
  saved: number;
  /** Rows Grader could not save. */
  failed: { studentId: string; message: string }[];
  /** J;DE runs: the outcome of sending each row; saving in Grader and sending are independent. */
  jide?: JideSendDto[];
}

export interface GradeflowSettingsDto {
  maxBudgetUsd: number;
  timeoutMinutes: number;
}

export interface GradeflowErrorDto {
  name: string;
  message: string;
  /** Set for agent failures, e.g. NOT_LOGGED_IN or TIMEOUT. */
  code?: string;
  /** Set when saving needs the teacher to confirm replacing this many results. */
  count?: number;
}

export type GradeflowResultDto<T> = { ok: true; value: T } | { ok: false; error: GradeflowErrorDto };

export interface GradeflowProgressEventDto {
  runId: string;
  event: GradeflowProgressDto;
}

export interface PickPathRequest {
  kind: 'file' | 'directory';
  title: string;
}
