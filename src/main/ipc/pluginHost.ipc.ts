import type { z } from 'zod';
import type { PluginCaller } from '../../application/PluginCaller';
import type { PluginHostService } from '../../application/PluginHostService';
import type { PluginSecretService } from '../../application/PluginSecretService';
import type { PluginStorageService } from '../../application/PluginStorageService';
import type { Result } from '../../domain/shared/Result';
import { IPC } from '../../shared/ipc-channels';
import type { PluginResult } from '../../shared/plugin-api';
import type { PluginWindowRegistry } from '../plugins/PluginWindowRegistry';
import { toPluginResult } from '../plugins/pluginResult';
import {
  createImpromptuSchema,
  deleteImpromptuSchema,
  secretKeySchema,
  secretSetSchema,
  storageKeySchema,
  storageKeysSchema,
  storageSetSchema,
} from './pluginSchemas';

/** The part of Electron's ipcMain this file needs; lets the handlers be tested without Electron. */
export interface IpcMainLike {
  handle(channel: string, listener: (event: { sender: { id: number } }, payload?: unknown) => unknown): void;
}

export interface PluginHostIpcDeps {
  registry: Pick<PluginWindowRegistry<unknown>, 'callerFor'>;
  host: Pick<PluginHostService, 'context' | 'createImpromptu' | 'deleteImpromptu'>;
  storage: Pick<PluginStorageService, 'get' | 'set' | 'delete' | 'keys'>;
  secrets: Pick<PluginSecretService, 'get' | 'set' | 'delete'>;
  /** A plugin created or deleted data of the course. */
  onDataChanged(courseId: string): void;
  logError(message: string, error: unknown): void;
}

const failure = (code: 'PERMISSION_DENIED' | 'VALIDATION' | 'INTERNAL', message: string): PluginResult<never> => ({
  ok: false,
  error: { code, message },
});

/**
 * The bridge behind `window.grader`. Whoever calls is the plugin and course registered for the sending window;
 * the payload is validated and carries no identity. No logic here: validate, call the service, translate the result.
 */
export function registerPluginHostHandlers(ipc: IpcMainLike, deps: PluginHostIpcDeps): void {
  const { registry, host, storage, secrets } = deps;

  function bridge<I, T>(
    channel: string,
    schema: z.ZodType<I>,
    run: (caller: PluginCaller, input: I) => Promise<Result<T>>,
    changesData = false,
  ): void {
    ipc.handle(channel, async (event, payload) => {
      const caller = registry.callerFor(event.sender.id);
      if (!caller) return failure('PERMISSION_DENIED', 'Not a plugin window');

      const input = schema.safeParse(payload);
      if (!input.success) {
        const problems = input.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`);
        return failure('VALIDATION', problems.join('; '));
      }

      try {
        const result = await run(caller, input.data);
        if (changesData && result.ok) deps.onDataChanged(caller.courseId);
        return toPluginResult(result);
      } catch (error) {
        deps.logError(`Plugin bridge call ${channel} failed`, error);
        return failure('INTERNAL', 'Internal error');
      }
    });
  }

  const noPayload = { safeParse: () => ({ success: true as const, data: undefined }) } as unknown as z.ZodType<undefined>;

  bridge(IPC.PLUGIN_HOST_CONTEXT, noPayload, (caller) => host.context(caller));
  bridge(IPC.PLUGIN_HOST_STORAGE_GET, storageKeySchema, (caller, i) => storage.get(caller, i.scope, i.key));
  bridge(IPC.PLUGIN_HOST_STORAGE_SET, storageSetSchema, (caller, i) => storage.set(caller, i.scope, i.key, i.value));
  bridge(IPC.PLUGIN_HOST_STORAGE_DELETE, storageKeySchema, (caller, i) => storage.delete(caller, i.scope, i.key));
  bridge(IPC.PLUGIN_HOST_STORAGE_KEYS, storageKeysSchema, (caller, i) => storage.keys(caller, i.scope, i.prefix));
  bridge(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, createImpromptuSchema, (caller, i) => host.createImpromptu(caller, i), true);
  bridge(IPC.PLUGIN_HOST_DELETE_IMPROMPTU, deleteImpromptuSchema, (caller, i) => host.deleteImpromptu(caller, i.assessmentId), true);
  bridge(IPC.PLUGIN_HOST_SECRETS_GET, secretKeySchema, (caller, i) => secrets.get(caller, i.key));
  bridge(IPC.PLUGIN_HOST_SECRETS_SET, secretSetSchema, (caller, i) => secrets.set(caller, i.key, i.value));
  bridge(IPC.PLUGIN_HOST_SECRETS_DELETE, secretKeySchema, (caller, i) => secrets.delete(caller, i.key));
}
