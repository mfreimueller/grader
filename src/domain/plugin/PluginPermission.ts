import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export const PLUGIN_PERMISSIONS = ['course:read', 'storage', 'assessment:impromptu', 'secrets'] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export function parsePluginPermission(raw: string): Result<PluginPermission> {
  const permission = PLUGIN_PERMISSIONS.find((p) => p === raw);
  if (permission === undefined) {
    return Result.fail(new ValidationError(`Unknown plugin permission "${raw}"`));
  }
  return Result.ok(permission);
}
