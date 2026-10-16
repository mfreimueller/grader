import { NotInCourseError, PluginPermissionDeniedError } from '../../application/PluginCaller';
import type { Result } from '../../domain/shared/Result';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import type { PluginErrorCode, PluginResult } from '../../shared/plugin-api';

function codeOf(error: Error): PluginErrorCode {
  if (error instanceof PluginPermissionDeniedError) return 'PERMISSION_DENIED';
  if (error instanceof NotInCourseError) return 'NOT_IN_COURSE';
  if (error instanceof NotFoundError) return 'NOT_FOUND';
  if (error instanceof ValidationError || error instanceof ConflictError) return 'VALIDATION';
  return 'INTERNAL';
}

/** What a plugin sees of a Result: the error text of an expected failure, but never the details of an unexpected one. */
export function toPluginResult<T>(result: Result<T>): PluginResult<T> {
  if (result.ok) return { ok: true, value: result.value };
  const code = codeOf(result.error);
  return { ok: false, error: { code, message: code === 'INTERNAL' ? 'Internal error' : result.error.message } };
}
