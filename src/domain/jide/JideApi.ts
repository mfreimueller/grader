import { DomainError } from '../../shared/errors';
import { Result } from '../shared/Result';

/** What the J;DE grading API returns (contract: J;DE SPEC §5 "Grading API"). */
export interface JideStudent {
  id: string;
  name: string;
}

export interface JideCourse {
  id: string;
  subject: string;
  className: string;
  students: JideStudent[];
}

export interface JideExercise {
  id: string;
  /** The `id` of the exercise's `exercise.yaml`. */
  slug: string;
  title: string;
  difficulty: string | null;
  unlockedAt: string | null;
  deadline: string | null;
}

export interface JideHandinFile {
  path: string;
  content: string;
}

export interface JideHandin {
  handinId: string;
  studentId: string;
  submittedAt: string | null;
  late: boolean;
  testsPassed: number | null;
  testsTotal: number | null;
  graded: boolean;
  files: JideHandinFile[];
}

export interface JideLineComment {
  path: string;
  /** 1-based. */
  line: number;
  text: string;
}

export interface JideGrade {
  symbol: string;
  comment: string;
  lineComments: JideLineComment[];
}

export const JIDE_ERROR_NEWER_HANDIN = 'NEWER_HANDIN';

/**
 * A failed call. `message` is safe to show: the server's German message, or a text of ours for network errors and
 * unexpected answers. It never contains the API key.
 */
export class JideApiError extends DomainError {
  constructor(
    message: string,
    /** HTTP status; 0 when the server could not be reached at all. */
    readonly status: number,
    /** The `error` field of the server's body, e.g. `NEWER_HANDIN`; null when there was none. */
    readonly code: string | null = null,
  ) {
    super(message);
  }

  get isNewerHandin(): boolean {
    return this.status === 409 && this.code === JIDE_ERROR_NEWER_HANDIN;
  }
}

export type JideResult<T> = Result<T, JideApiError>;

/** Port of the J;DE grading API. One instance belongs to one server and one API key. */
export interface JideApi {
  listCourses(): Promise<JideResult<JideCourse[]>>;
  listExercises(courseId: string): Promise<JideResult<JideExercise[]>>;
  /** The exercise zip. */
  fetchPackage(exerciseId: string): Promise<JideResult<Uint8Array>>;
  /** The latest hand-in of every student who handed in. */
  listHandins(courseId: string, exerciseId: string): Promise<JideResult<JideHandin[]>>;
  putGrade(handinId: string, grade: JideGrade): Promise<JideResult<{ gradedAt: string }>>;
}
