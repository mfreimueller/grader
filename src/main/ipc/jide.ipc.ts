import type { z } from 'zod';
import type { JideConnectionService } from '../../application/JideConnectionService';
import { JideApiError } from '../../domain/jide/JideApi';
import type { Result } from '../../domain/shared/Result';
import { IPC } from '../../shared/ipc-channels';
import type { JideResultDto } from '../../shared/jide-api';
import { courseIdSchema, jideSettingsSchema, linkOverviewSchema, saveLinksSchema } from './jideSchemas';

export interface JideIpcMain {
  handle(channel: string, listener: (event: unknown, payload?: unknown) => unknown): void;
}

export interface JideIpcDeps {
  service: Pick<
    JideConnectionService,
    'getSettings' | 'saveSettings' | 'clearSettings' | 'test' | 'linkOverview' | 'saveLinks' | 'exercisesOf'
  >;
  /** Receives the call and the name of the error only: messages may hold names. */
  logError(message: string): void;
}

const failure = (name: string, message: string): JideResultDto<never> => ({ ok: false, error: { name, message } });

function toResultDto<T>(result: Result<T>): JideResultDto<T> {
  if (result.ok) return { ok: true, value: result.value };
  // Domain errors (and the server's own German messages) are safe to show.
  const { error } = result;
  return { ok: false, error: { name: error instanceof JideApiError ? 'JideApiError' : error.name, message: error.message } };
}

/** Thin handlers: validate, call the service, translate the result. */
export function registerJideHandlers(ipc: JideIpcMain, deps: JideIpcDeps): void {
  const { service } = deps;

  function route<I, T>(
    channel: string,
    schema: z.ZodType<I> | null,
    run: (input: I) => Promise<JideResultDto<T>>,
  ): void {
    ipc.handle(channel, async (_event, payload) => {
      let input = undefined as I;
      if (schema) {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return failure('ValidationError', 'Ungültige Eingabe');
        input = parsed.data;
      }
      try {
        return await run(input);
      } catch (error) {
        deps.logError(`J;DE call ${channel} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
        return failure('InternalError', 'Es ist ein interner Fehler aufgetreten.');
      }
    });
  }

  route(IPC.JIDE_GET_SETTINGS, null, async () => ({ ok: true, value: await service.getSettings() }));
  route(IPC.JIDE_SET_SETTINGS, jideSettingsSchema, async (i) => toResultDto(await service.saveSettings(i)));
  route(IPC.JIDE_CLEAR_SETTINGS, null, async () => {
    await service.clearSettings();
    return { ok: true, value: await service.getSettings() };
  });
  route(IPC.JIDE_TEST, jideSettingsSchema, async (i) => toResultDto(await service.test(i)));
  route(IPC.JIDE_LINK_OVERVIEW, linkOverviewSchema, async (i) =>
    toResultDto(await service.linkOverview(i.courseId, i.jideCourseId)),
  );
  route(IPC.JIDE_SAVE_LINKS, saveLinksSchema, async (i) => toResultDto(await service.saveLinks(i)));
  route(IPC.JIDE_LIST_EXERCISES, courseIdSchema, async (i) => toResultDto(await service.exercisesOf(i.courseId)));
}

