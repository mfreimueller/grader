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

export interface ReviewRowDto {
  studentId: string;
  proposal: { symbol: string | null; score: number | null } | null;
  comment: string;
  flags: ('TOKEN_IN_COMMENT' | 'COMMENT_TRUNCATED')[];
  current: CurrentResultDto | null;
}

export interface ProposalsDto {
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
}

export interface SaveResultDto {
  saved: number;
  failed: { studentId: string; message: string }[];
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
