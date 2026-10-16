import type { PluginErrorCode, PluginResult } from '../../../../src/shared/plugin-api';
import { describeError, t } from '../i18n';

/** Grader refused or failed a call of the bridge. */
export class BridgeFailure extends Error {
  constructor(
    readonly code: PluginErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BridgeFailure';
  }
}

/** The value of a bridge answer; a refusal becomes a thrown BridgeFailure. */
export function unwrap<T>(result: PluginResult<T>): T {
  if (!result.ok) throw new BridgeFailure(result.error.code, result.error.message);
  return result.value;
}

/** What the teacher reads. Only a refusal from Grader is explained; anything else is a plain error message. */
export function errorText(error: unknown): string {
  return error instanceof BridgeFailure ? describeError(error) : t('errors.INTERNAL');
}

/**
 * A plain copy of the data. A Vue reactive object is a Proxy, and a Proxy cannot be sent over the bridge
 * ("could not be cloned"), so everything handed to it goes through here.
 */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
