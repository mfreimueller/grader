import type { CourseRepository } from '../domain/grade/CourseRepository';
import { suggestCourseLink, suggestStudentLinks } from '../domain/jide/JideLinkSuggestion';
import type { JideApi, JideCourse } from '../domain/jide/JideApi';
import type { JideConnectionRepository } from '../domain/jide/JideConnectionRepository';
import type { JideLinkRepository } from '../domain/jide/JideLinkRepository';
import type { SecretCipher } from '../domain/plugin/SecretCipher';
import { Result } from '../domain/shared/Result';
import type {
  JideExerciseDto,
  JideLinkOverviewDto,
  JideSaveLinksInput,
  JideSettingsDto,
  JideSettingsInput,
  JideTestResultDto,
} from '../shared/jide-api';
import { NotFoundError, ValidationError } from '../shared/errors';
import type { CourseRosterService } from './CourseRosterService';

export interface JideConnectionDeps {
  connectionRepo: JideConnectionRepository;
  linkRepo: JideLinkRepository;
  cipher: SecretCipher;
  courseRepo: Pick<CourseRepository, 'findById'>;
  rosterService: Pick<CourseRosterService, 'rosterOf'>;
  createApi: (baseUrl: string, apiKey: string) => JideApi;
  now: () => Date;
}

const invalid = (message: string): Result<never> => Result.fail(new ValidationError(message));

const NOT_CONFIGURED = 'J;DE ist noch nicht eingerichtet. Bitte tragen Sie Adresse und API-Schlüssel in den Einstellungen ein.';
const NO_ENCRYPTION = 'Der API-Schlüssel kann nicht gespeichert werden: Dieses System bietet keine sichere, verschlüsselte Ablage.';
const CANNOT_DECRYPT = 'Der API-Schlüssel kann auf diesem Computer nicht gelesen werden (z. B. nach einer Wiederherstellung von einem anderen). Bitte geben Sie ihn erneut ein.';
const NOT_LINKED = 'Dieser Kurs ist noch nicht mit einem J;DE-Kurs verknüpft.';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The address to store: https (http only for the own computer), no credentials, query or fragment, no trailing slash. */
export function normaliseBaseUrl(raw: string): Result<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return invalid('Bitte eine gültige Adresse angeben, z. B. https://jide.example.at');
  }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
  if (!secure) return invalid('Die Adresse muss mit https:// beginnen.');
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    return invalid('Die Adresse darf keine Zugangsdaten, Parameter oder Anker enthalten.');
  }
  return Result.ok(`${url.origin}${url.pathname.replace(/\/+$/, '')}`);
}

function checkKey(raw: string): Result<string> {
  const key = raw.trim();
  if (!/^jide_\S{4,200}$/.test(key)) return invalid('Der API-Schlüssel beginnt mit „jide_“ und enthält keine Leerzeichen.');
  return Result.ok(key);
}

/**
 * The connection to J;DE (address and API key) and the links between Grader and J;DE courses and students.
 * The key is stored encrypted and is only ever handed to the API client; nothing here returns or logs it.
 */
export class JideConnectionService {
  constructor(private readonly deps: JideConnectionDeps) {}

  async getSettings(): Promise<JideSettingsDto> {
    const stored = await this.deps.connectionRepo.get();
    return {
      baseUrl: stored?.baseUrl ?? '',
      hasKey: stored !== null,
      encryptionAvailable: this.deps.cipher.isAvailable(),
    };
  }

  async saveSettings(input: JideSettingsInput): Promise<Result<JideSettingsDto>> {
    const baseUrl = normaliseBaseUrl(input.baseUrl);
    if (!baseUrl.ok) return Result.fail(baseUrl.error);
    const stored = await this.deps.connectionRepo.get();
    let encryptedKey: Uint8Array | null = null;
    if (input.apiKey.trim() !== '' || stored === null) {
      const key = checkKey(input.apiKey);
      if (!key.ok) return Result.fail(key.error);
      if (!this.deps.cipher.isAvailable()) return invalid(NO_ENCRYPTION);
      encryptedKey = this.deps.cipher.encrypt(key.value);
    }
    await this.deps.connectionRepo.save(baseUrl.value, encryptedKey, this.deps.now());
    return Result.ok(await this.getSettings());
  }

  async clearSettings(): Promise<void> {
    await this.deps.connectionRepo.clear();
  }

  /** Tries the address and key of the form (an empty key means the stored one) without saving anything. */
  async test(input: JideSettingsInput): Promise<Result<JideTestResultDto>> {
    const baseUrl = normaliseBaseUrl(input.baseUrl);
    if (!baseUrl.ok) return Result.fail(baseUrl.error);
    let key: string;
    if (input.apiKey.trim() === '') {
      const stored = await this.storedKey();
      if (!stored.ok) return Result.fail(stored.error);
      key = stored.value.apiKey;
    } else {
      const checked = checkKey(input.apiKey);
      if (!checked.ok) return Result.fail(checked.error);
      key = checked.value;
    }
    const courses = await this.deps.createApi(baseUrl.value, key).listCourses();
    return courses.ok ? Result.ok({ courseCount: courses.value.length }) : Result.fail(courses.error);
  }

  /** The API client of the stored connection. */
  async api(): Promise<Result<JideApi>> {
    const stored = await this.storedKey();
    if (!stored.ok) return Result.fail(stored.error);
    return Result.ok(this.deps.createApi(stored.value.baseUrl, stored.value.apiKey));
  }

  /** The J;DE course linked to a Grader course, or null. */
  linkedJideCourseId(courseId: string): Promise<string | null> {
    return this.deps.linkRepo.courseLink(courseId);
  }

  /** studentId → J;DE student id for the students that are linked. */
  studentLinksOf(studentIds: string[]): Promise<Map<string, string>> {
    return this.deps.linkRepo.studentLinks(studentIds);
  }

  async exercisesOf(courseId: string): Promise<Result<JideExerciseDto[]>> {
    const jideCourseId = await this.deps.linkRepo.courseLink(courseId);
    if (jideCourseId === null) return invalid(NOT_LINKED);
    const api = await this.api();
    if (!api.ok) return Result.fail(api.error);
    const exercises = await api.value.listExercises(jideCourseId);
    if (!exercises.ok) return Result.fail(exercises.error);
    return Result.ok(exercises.value.map(({ id, slug, title }) => ({ id, slug, title })));
  }

  /**
   * What the linking panel shows for a Grader course. `jideCourseId` selects another J;DE course than the
   * stored one (the teacher is changing the link); without it the stored link, else a name-based proposal.
   */
  async linkOverview(courseId: string, jideCourseId?: string | null): Promise<Result<JideLinkOverviewDto>> {
    const course = await this.deps.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));
    const roster = await this.deps.rosterService.rosterOf(courseId);
    if (!roster.ok) return Result.fail(roster.error);
    const api = await this.api();
    if (!api.ok) return Result.fail(api.error);
    const courses = await api.value.listCourses();
    if (!courses.ok) return Result.fail(courses.error);

    const stored = await this.deps.linkRepo.courseLink(courseId);
    const proposal = suggestCourseLink({ title: course.title, className: course.schoolClass.name }, courses.value);
    const shownId = jideCourseId !== undefined ? jideCourseId : (stored ?? proposal);
    const shown = courses.value.find((c) => c.id === shownId) ?? null;
    const jideStudents = shown?.students ?? [];

    const students = roster.value.map((s) => ({ id: s.id.value, firstName: s.name.firstName, lastName: s.name.lastName }));
    const confirmed = await this.deps.linkRepo.studentLinks(students.map((s) => s.id));
    const known = new Set(jideStudents.map((j) => j.id));
    const suggested = suggestStudentLinks(students, jideStudents);
    return Result.ok({
      jideCourses: courses.value.map(({ id, subject, className }) => ({ id, subject, className })),
      jideCourseId: shown?.id ?? null,
      courseConfirmed: shown !== null && shown.id === stored,
      jideStudents: jideStudents.map(({ id, name }) => ({ id, name })),
      students: students.map((s) => {
        const link = confirmed.get(s.id) ?? null;
        return {
          studentId: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          // A stored link to somebody who is not in the shown J;DE course is not shown as confirmed.
          jideStudentId: link !== null && known.has(link) ? link : null,
          suggestedJideStudentId: suggested.get(s.id) ?? null,
        };
      }),
    });
  }

  /** Stores the teacher's confirmed links of one course. Everything is checked against the J;DE course first. */
  async saveLinks(input: JideSaveLinksInput): Promise<Result<void>> {
    const course = await this.deps.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));
    const roster = await this.deps.rosterService.rosterOf(input.courseId);
    if (!roster.ok) return Result.fail(roster.error);

    let jideCourse: JideCourse | null = null;
    if (input.jideCourseId !== null) {
      const api = await this.api();
      if (!api.ok) return Result.fail(api.error);
      const courses = await api.value.listCourses();
      if (!courses.ok) return Result.fail(courses.error);
      jideCourse = courses.value.find((c) => c.id === input.jideCourseId) ?? null;
      if (jideCourse === null) return invalid('Dieser J;DE-Kurs existiert nicht (mehr).');
    }

    const rosterIds = new Set(roster.value.map((s) => s.id.value));
    const known = new Set(jideCourse?.students.map((j) => j.id) ?? []);
    const used = new Set<string>();
    for (const { studentId, jideStudentId } of input.links) {
      if (!rosterIds.has(studentId)) return invalid('Eine Schülerin oder ein Schüler gehört nicht zu diesem Kurs.');
      if (jideStudentId === null) continue;
      if (!known.has(jideStudentId)) return invalid('Eine J;DE-Person gehört nicht zum gewählten J;DE-Kurs.');
      if (used.has(jideStudentId)) return invalid('Dieselbe J;DE-Person ist mehreren Schülerinnen oder Schülern zugeordnet.');
      used.add(jideStudentId);
    }

    await this.deps.linkRepo.setCourseLink(input.courseId, input.jideCourseId);
    await this.deps.linkRepo.setStudentLinks(input.links);
    return Result.ok(undefined as void);
  }

  private async storedKey(): Promise<Result<{ baseUrl: string; apiKey: string }>> {
    const stored = await this.deps.connectionRepo.get();
    if (stored === null) return invalid(NOT_CONFIGURED);
    if (!this.deps.cipher.isAvailable()) return invalid(NO_ENCRYPTION);
    try {
      return Result.ok({ baseUrl: stored.baseUrl, apiKey: this.deps.cipher.decrypt(stored.encryptedKey) });
    } catch {
      return invalid(CANNOT_DECRYPT);
    }
  }
}
