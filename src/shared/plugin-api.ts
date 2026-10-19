/**
 * The bridge between Grader and a plugin (`window.grader` inside a plugin window).
 * Types only: the preload, the host services and the bundled plugins all import from here.
 * Everything that crosses the bridge is a plain, JSON-serialisable object.
 */

export const PLUGIN_API_VERSION = 1;

export type PluginErrorCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'NOT_IN_COURSE'
  | 'INTERNAL';

export type PluginResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: PluginErrorCode; message: string } };

export interface PluginStudent {
  id: string;
  firstName: string;
  lastName: string;
  /** `#rrggbb`, or null when the student has no color. */
  color: string | null;
}

export interface PluginCategory {
  id: string;
  title: string;
  /** `TERTIARY` (+ ~ −) or `NUMERIC` (points). */
  gradingType: string;
  isMitarbeit: boolean;
  isHidden: boolean;
}

export interface PluginSession {
  id: string;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  notes: string;
}

export interface PluginContext {
  apiVersion: typeof PLUGIN_API_VERSION;
  plugin: { id: string; version: string };
  course: { id: string; title: string };
  schoolClass: { id: string; name: string };
  /** e.g. `2026/27` */
  schoolYear: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  today: string;
  /**
   * The students taught in the course who are present today: everybody on the course list except the
   * ones marked absent in today's session. All of them when there is no session today.
   */
  students: PluginStudent[];
  /**
   * Everybody taught in the course, absent today or not: the course list as it is. Same order and shape as
   * `students`, which is the subset without today's absent students.
   */
  courseStudents: PluginStudent[];
  categories: PluginCategory[];
  /** Newest first. */
  sessions: PluginSession[];
}

/** Which session a new assessment lands in. The session is created when it does not exist yet. */
export type SessionTarget =
  | { kind: 'today' }
  /** A calendar day, `YYYY-MM-DD`, not in the future. */
  | { kind: 'date'; date: string }
  /** An existing session of this course, e.g. one of `PluginContext.sessions`. */
  | { kind: 'session'; sessionId: string };

export interface CreateImpromptuRequest {
  studentId: string;
  categoryId: string;
  /** Defaults to `{ kind: 'today' }`. */
  session?: SessionTarget | undefined;
  /** Defaults to the title of the category, at most 200 characters. */
  title?: string | undefined;
  /** `PLUS`, `PLUS_WELLE`, `WELLE`, `MINUS_WELLE` or `MINUS`. Defaults to `WELLE` for a tertiary category. */
  symbol?: string | undefined;
  /** Points reached. Needs `maxPoints`, and must lie between 0 and `maxPoints`. */
  score?: number | undefined;
  maxPoints?: number | undefined;
  /** A note on the result, e.g. the topics asked, at most 2000 characters. Blank means no note. */
  note?: string | undefined;
}

export interface CreateImpromptuResult {
  assessmentId: string;
  performanceId: string;
  sessionId: string;
}

export interface KvScope {
  get(key: string): Promise<PluginResult<unknown>>;
  set(key: string, value: unknown): Promise<PluginResult<void>>;
  delete(key: string): Promise<PluginResult<void>>;
  keys(prefix?: string): Promise<PluginResult<string[]>>;
}

/**
 * Secrets such as an access token, needs the `secrets` permission. Plugin-global (not per course), stored
 * encrypted with the operating system's key store. They only decrypt on the computer that stored them.
 */
export interface SecretsApi {
  /** The secret, or null when it is not set. */
  get(key: string): Promise<PluginResult<string | null>>;
  /** A non-empty string of at most 16 KiB. Fails when the system cannot encrypt: nothing is stored in plain text. */
  set(key: string, value: string): Promise<PluginResult<void>>;
  delete(key: string): Promise<PluginResult<void>>;
}

export interface GraderPluginApi {
  context(): Promise<PluginResult<PluginContext>>;
  /** Stored per plugin and per course; `storage.global` is shared by all courses of the plugin. */
  storage: KvScope & { global: KvScope };
  secrets: SecretsApi;
  assessment: {
    createImpromptu(request: CreateImpromptuRequest): Promise<PluginResult<CreateImpromptuResult>>;
    /** Only assessments this plugin created in this course. */
    deleteImpromptu(assessmentId: string): Promise<PluginResult<void>>;
    /** Replaces the note of an assessment this plugin created in this course; blank removes it. */
    setImpromptuNote(assessmentId: string, note: string): Promise<PluginResult<void>>;
  };
}
