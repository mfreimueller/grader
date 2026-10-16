import { PluginDataRepository } from '../domain/plugin/PluginDataRepository';
import { Result } from '../domain/shared/Result';
import { ValidationError } from '../shared/errors';
import { CourseService } from './CourseService';
import { PluginCaller, requirePermission } from './PluginCaller';

export const MAX_VALUE_BYTES = 256 * 1024;

/** `course` is private to the course the plugin was launched from, `global` is shared by all its courses. */
export type StorageScope = 'course' | 'global';

const GLOBAL_COURSE_ID = '';
const KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
const PREFIX_PATTERN = /^[A-Za-z0-9_.:-]{0,128}$/;

/** The key-value store a plugin sees. The plugin id and the course always come from the caller. */
export class PluginStorageService {
  constructor(
    private readonly repo: PluginDataRepository,
    private readonly courseService: CourseService,
    private readonly now: () => Date,
  ) {}

  /** The stored value, or null when the key is not set. */
  async get(caller: PluginCaller, scope: StorageScope, key: string): Promise<Result<unknown>> {
    const courseId = await this.open(caller, scope, key);
    if (!courseId.ok) return Result.fail(courseId.error);

    const raw = await this.repo.get(caller.manifest.id, courseId.value, key);
    if (raw === null) return Result.ok(null);
    try {
      return Result.ok(JSON.parse(raw) as unknown);
    } catch {
      return Result.fail(new ValidationError(`Stored value of "${key}" is not valid JSON`));
    }
  }

  async set(caller: PluginCaller, scope: StorageScope, key: string, value: unknown): Promise<Result<void>> {
    const courseId = await this.open(caller, scope, key);
    if (!courseId.ok) return Result.fail(courseId.error);
    const json = encode(value);
    if (!json.ok) return Result.fail(json.error);

    await this.repo.set(caller.manifest.id, courseId.value, key, json.value, this.now());
    return Result.ok(undefined as void);
  }

  async delete(caller: PluginCaller, scope: StorageScope, key: string): Promise<Result<void>> {
    const courseId = await this.open(caller, scope, key);
    if (!courseId.ok) return Result.fail(courseId.error);

    await this.repo.delete(caller.manifest.id, courseId.value, key);
    return Result.ok(undefined as void);
  }

  async keys(caller: PluginCaller, scope: StorageScope, prefix = ''): Promise<Result<string[]>> {
    if (!PREFIX_PATTERN.test(prefix)) {
      return Result.fail(new ValidationError('Key prefix may only contain letters, digits and _ . : -'));
    }
    const courseId = await this.open(caller, scope);
    if (!courseId.ok) return Result.fail(courseId.error);

    return Result.ok(await this.repo.keys(caller.manifest.id, courseId.value, prefix));
  }

  /** Checks permission, key and course, and returns the course id the data is stored under. */
  private async open(caller: PluginCaller, scope: StorageScope, key?: string): Promise<Result<string>> {
    const allowed = requirePermission(caller, 'storage');
    if (!allowed.ok) return Result.fail(allowed.error);
    if (key !== undefined && !KEY_PATTERN.test(key)) {
      return Result.fail(new ValidationError('Key must be 1-128 characters of letters, digits and _ . : -'));
    }
    if (scope === 'global') return Result.ok(GLOBAL_COURSE_ID);

    // A window can outlive its course; do not write data for a course that no longer exists.
    const course = await this.courseService.findById(caller.courseId);
    if (!course.ok) return Result.fail(course.error);
    return Result.ok(caller.courseId);
  }
}

function encode(value: unknown): Result<string> {
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    return Result.fail(new ValidationError('Value cannot be stored: it is not JSON-serialisable'));
  }
  if (json === undefined) {
    return Result.fail(new ValidationError('Value cannot be stored: it is not JSON-serialisable'));
  }
  if (Buffer.byteLength(json, 'utf8') > MAX_VALUE_BYTES) {
    return Result.fail(new ValidationError(`Value is larger than ${MAX_VALUE_BYTES / 1024} KiB`));
  }
  return Result.ok(json);
}
