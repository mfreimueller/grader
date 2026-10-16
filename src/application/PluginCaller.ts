import { PluginManifest } from '../domain/plugin/PluginManifest';
import { PluginPermission } from '../domain/plugin/PluginPermission';
import { Result } from '../domain/shared/Result';
import { DomainError } from '../shared/errors';

/**
 * Who is calling the bridge. The main process derives it from the plugin window that sent the message,
 * never from anything the plugin passes itself.
 */
export interface PluginCaller {
  manifest: PluginManifest;
  /** The course the plugin was launched from; everything it does is scoped to it. */
  courseId: string;
}

/** The plugin may not do this: it lacks a permission, or the thing it touches is not its own. */
export class PluginPermissionDeniedError extends DomainError {}

export class NotInCourseError extends DomainError {
  constructor(what: string, id: string) {
    super(`${what} ${id} does not belong to this course`);
  }
}

export function requirePermission(caller: PluginCaller, permission: PluginPermission): Result<void> {
  if (!caller.manifest.permits(permission)) {
    return Result.fail(new PluginPermissionDeniedError(`Plugin lacks the permission "${permission}"`));
  }
  return Result.ok(undefined as void);
}
