import type { z } from 'zod';
import { OverwriteNeedsConfirmationError } from '../../application/GradeflowSaver';
import type { GradeflowService } from '../../application/GradeflowService';
import { AgentRunError } from '../../domain/gradeflow/AgentRunner';
import type { Result } from '../../domain/shared/Result';
import type {
  GradeflowErrorDto,
  GradeflowProgressEventDto,
  GradeflowResultDto,
  GradeflowSettingsDto,
  PickPathRequest,
} from '../../shared/gradeflow-api';
import { IPC } from '../../shared/ipc-channels';
import {
  confirmSchema,
  excludeFilesSchema,
  gradeflowSettingsSchema,
  pickPathSchema,
  prepareJideSchema,
  prepareSchema,
  runIdSchema,
  saveSchema,
} from './gradeflowSchemas';

/** The part of a WebContents this file needs; lets the handlers be tested without Electron. */
export interface GradeflowIpcEvent {
  sender: {
    id: number;
    isDestroyed(): boolean;
    send(channel: string, payload: unknown): void;
  };
}

export interface GradeflowIpcMain {
  handle(channel: string, listener: (event: GradeflowIpcEvent, payload?: unknown) => unknown): void;
}

export interface GradeflowIpcDeps {
  service: Pick<
    GradeflowService,
    'listSkills' | 'prepare' | 'prepareJide' | 'confirm' | 'excludeFiles' | 'start' | 'cancel' | 'save' | 'discard'
  >;
  /** Shows a dialog on the window of the sender; null when the teacher cancelled. */
  pickPath(senderId: number, request: PickPathRequest): Promise<string | null>;
  /** Opens the folder of the user's skills; resolves to the failure text of the system, '' on success. */
  openSkillsFolder(): Promise<string>;
  settings: { get(): GradeflowSettingsDto; set(value: GradeflowSettingsDto): void };
  /** Receives the call and the name of the error only: messages and stacks may hold student data. */
  logError(message: string): void;
}

const failure = (name: string, message: string): GradeflowResultDto<never> => ({
  ok: false,
  error: { name, message },
});

function toErrorDto(error: Error): GradeflowErrorDto {
  const dto: GradeflowErrorDto = { name: error.name, message: error.message };
  if (error instanceof AgentRunError) dto.code = error.code;
  if (error instanceof OverwriteNeedsConfirmationError) dto.count = error.count;
  return dto;
}

function toResultDto<T>(result: Result<T>): GradeflowResultDto<T> {
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: toErrorDto(result.error) };
}

/** Thin handlers: validate, call the service, translate the result. */
export function registerGradeflowHandlers(ipc: GradeflowIpcMain, deps: GradeflowIpcDeps): void {
  const { service } = deps;

  function route<I, T>(
    channel: string,
    schema: z.ZodType<I> | null,
    run: (input: I, event: GradeflowIpcEvent) => Promise<GradeflowResultDto<T>> | GradeflowResultDto<T>,
  ): void {
    ipc.handle(channel, async (event, payload) => {
      let input = undefined as I;
      if (schema) {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          const problems = parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`);
          return failure('ValidationError', problems.join('; '));
        }
        input = parsed.data;
      }
      try {
        return await run(input, event);
      } catch (error) {
        deps.logError(`Gradeflow call ${channel} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
        return failure('InternalError', 'Internal error');
      }
    });
  }

  route(IPC.GRADEFLOW_LIST_SKILLS, null, async () => ({ ok: true, value: await service.listSkills() }));
  route(IPC.GRADEFLOW_PREPARE, prepareSchema, async (i) => toResultDto(await service.prepare(i)));
  route(IPC.GRADEFLOW_PREPARE_JIDE, prepareJideSchema, async (i) => toResultDto(await service.prepareJide(i)));
  route(IPC.GRADEFLOW_CONFIRM, confirmSchema, async (i) => toResultDto(await service.confirm(i.runId, i.overrides)));
  route(IPC.GRADEFLOW_EXCLUDE_FILES, excludeFilesSchema, async (i) =>
    toResultDto(await service.excludeFiles(i.runId, i.files)),
  );
  route(IPC.GRADEFLOW_START, runIdSchema, async (i, event) =>
    toResultDto(
      await service.start(i.runId, (progress) => {
        if (event.sender.isDestroyed()) return;
        const message: GradeflowProgressEventDto = { runId: i.runId, event: progress };
        event.sender.send(IPC.GRADEFLOW_PROGRESS, message);
      }),
    ),
  );
  route(IPC.GRADEFLOW_CANCEL, runIdSchema, async (i) => toResultDto(await service.cancel(i.runId)));
  route(IPC.GRADEFLOW_SAVE, saveSchema, async (i) =>
    toResultDto(await service.save(i.runId, i.rows, i.overwriteConfirmed)),
  );
  route(IPC.GRADEFLOW_DISCARD, runIdSchema, async (i) => toResultDto(await service.discard(i.runId)));
  route(IPC.GRADEFLOW_PICK_PATH, pickPathSchema, async (i, event) => ({
    ok: true,
    value: await deps.pickPath(event.sender.id, i),
  }));
  route(IPC.GRADEFLOW_OPEN_SKILLS_FOLDER, null, async () => {
    // The text of the system may hold a path; it stays in the main process.
    if ((await deps.openSkillsFolder()) === '') return { ok: true, value: undefined };
    deps.logError('Gradeflow skills folder could not be opened');
    return failure('OpenFolderError', 'Could not open the skills folder');
  });
  route(IPC.GRADEFLOW_GET_SETTINGS, null, () => ({ ok: true, value: deps.settings.get() }));
  route(IPC.GRADEFLOW_SET_SETTINGS, gradeflowSettingsSchema, (i) => {
    deps.settings.set(i);
    return { ok: true, value: i };
  });
}
