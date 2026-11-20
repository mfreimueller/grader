import {
  JideApi,
  JideApiError,
  JideCourse,
  JideExercise,
  JideGrade,
  JideHandin,
  JideResult,
} from '../../domain/jide/JideApi';
import { Result } from '../../domain/shared/Result';

const REQUEST_TIMEOUT_MS = 30_000;
const PACKAGE_TIMEOUT_MS = 120_000;
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;

const UNREACHABLE = 'J;DE ist nicht erreichbar.';
const UNEXPECTED = 'J;DE hat eine unerwartete Antwort geschickt.';
const REJECTED_KEY = 'J;DE hat den API-Schlüssel nicht akzeptiert.';

const fail = <T>(message: string, status = 0, code: string | null = null): JideResult<T> =>
  Result.fail(new JideApiError(message, status, code));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class Malformed extends Error {}

/** Ids are numeric in J;DE's database; the rest of Grader treats ids as strings. */
function id(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value !== '') return value;
  throw new Malformed();
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  throw new Malformed();
}

const textOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : text(value));

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Malformed();
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new Malformed();
}

function record(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new Malformed();
}

const parseCourses = (body: unknown): JideCourse[] =>
  list(body).map((raw) => {
    const c = record(raw);
    return {
      id: id(c.id),
      subject: text(c.subject),
      className: text(c.className),
      students: list(c.students).map((s) => ({ id: id(record(s).id), name: text(record(s).name) })),
    };
  });

const parseExercises = (body: unknown): JideExercise[] =>
  list(body).map((raw) => {
    const e = record(raw);
    return {
      id: id(e.id),
      slug: text(e.slug),
      title: text(e.title),
      difficulty: textOrNull(e.difficulty),
      unlockedAt: textOrNull(e.unlockedAt),
      deadline: textOrNull(e.deadline),
    };
  });

const parseHandins = (body: unknown): JideHandin[] =>
  list(body).map((raw) => {
    const h = record(raw);
    return {
      handinId: id(h.handinId),
      studentId: id(h.studentId),
      submittedAt: textOrNull(h.submittedAt),
      late: h.late === true,
      testsPassed: numberOrNull(h.testsPassed),
      testsTotal: numberOrNull(h.testsTotal),
      graded: h.graded === true,
      files: list(h.files).map((f) => ({ path: text(record(f).path), content: text(record(f).content) })),
    };
  });

const parseGradedAt = (body: unknown): { gradedAt: string } => ({ gradedAt: text(record(body).gradedAt) });

/** HTTP client of the J;DE grading API. The key only ever goes into the Authorization header. */
export class HttpJideApi implements JideApi {
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
  ) {
    this.base = baseUrl.replace(/\/+$/, '');
  }

  listCourses(): Promise<JideResult<JideCourse[]>> {
    return this.json('GET', '/api/v1/courses', undefined, parseCourses);
  }

  listExercises(courseId: string): Promise<JideResult<JideExercise[]>> {
    return this.json('GET', `/api/v1/courses/${encodeURIComponent(courseId)}/exercises`, undefined, parseExercises);
  }

  async fetchPackage(exerciseId: string): Promise<JideResult<Uint8Array>> {
    const response = await this.send('GET', `/api/v1/exercises/${encodeURIComponent(exerciseId)}/package`, undefined, PACKAGE_TIMEOUT_MS);
    if (!response.ok) return Result.fail(response.error);
    try {
      const bytes = new Uint8Array(await response.value.arrayBuffer());
      return bytes.length > MAX_PACKAGE_BYTES ? fail('Das Aufgabenpaket ist zu groß.') : Result.ok(bytes);
    } catch {
      return fail(UNREACHABLE);
    }
  }

  listHandins(courseId: string, exerciseId: string): Promise<JideResult<JideHandin[]>> {
    const path = `/api/v1/courses/${encodeURIComponent(courseId)}/exercises/${encodeURIComponent(exerciseId)}/handins`;
    return this.json('GET', path, undefined, parseHandins);
  }

  putGrade(handinId: string, grade: JideGrade): Promise<JideResult<{ gradedAt: string }>> {
    return this.json('PUT', `/api/v1/handins/${encodeURIComponent(handinId)}/grade`, grade, parseGradedAt);
  }

  private async json<T>(method: string, path: string, body: unknown, parse: (body: unknown) => T): Promise<JideResult<T>> {
    const response = await this.send(method, path, body, REQUEST_TIMEOUT_MS);
    if (!response.ok) return Result.fail(response.error);
    try {
      return Result.ok(parse(await response.value.json()));
    } catch {
      return fail(UNEXPECTED, response.value.status);
    }
  }

  private async send(
    method: string,
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<Result<Response, JideApiError>> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // The cause (address, key) stays out of the message.
      return Result.fail(new JideApiError(UNREACHABLE, 0));
    }
    if (response.ok) return Result.ok(response);
    return Result.fail(await this.errorOf(response));
  }

  private async errorOf(response: Response): Promise<JideApiError> {
    let code: string | null = null;
    let message: string | null = null;
    try {
      const body: unknown = await response.json();
      if (isRecord(body)) {
        if (typeof body.error === 'string') code = body.error;
        if (typeof body.message === 'string' && body.message !== '') message = body.message;
      }
    } catch {
      // No usable body: fall back to our own text.
    }
    const own = response.status === 401 ? REJECTED_KEY : `J;DE hat mit dem Fehler ${response.status} geantwortet.`;
    return new JideApiError(message ?? own, response.status, code);
  }
}
