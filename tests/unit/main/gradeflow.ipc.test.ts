import { OverwriteNeedsConfirmationError } from '../../../src/application/GradeflowSaver';
import type { GradeflowService } from '../../../src/application/GradeflowService';
import { AgentRunError } from '../../../src/domain/gradeflow/AgentRunner';
import { Result } from '../../../src/domain/shared/Result';
import type { GradeflowSettingsDto, PickPathRequest } from '../../../src/shared/gradeflow-api';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';
import { IPC } from '../../../src/shared/ipc-channels';
import { registerGradeflowHandlers } from '../../../src/main/ipc/gradeflow.ipc';
import type { GradeflowIpcEvent, GradeflowIpcMain } from '../../../src/main/ipc/gradeflow.ipc';

class FakeIpcMain implements GradeflowIpcMain {
  private readonly handlers = new Map<string, Parameters<GradeflowIpcMain['handle']>[1]>();
  handle(channel: string, listener: Parameters<GradeflowIpcMain['handle']>[1]): void {
    this.handlers.set(channel, listener);
  }
  channels(): string[] {
    return [...this.handlers.keys()];
  }
  invoke(channel: string, payload?: unknown, event: GradeflowIpcEvent = aSender().event): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return handler(event, payload);
  }
}

const aSender = (destroyed = false) => {
  const sent: [string, unknown][] = [];
  const event: GradeflowIpcEvent = {
    sender: { id: 7, isDestroyed: () => destroyed, send: (channel, payload) => sent.push([channel, payload]) },
  };
  return { event, sent };
};

const ok = <T>(value: T): Promise<Result<T>> => Promise.resolve(Result.ok(value));
const fail = <T>(error: Error): Promise<Result<T>> => Promise.resolve(Result.fail(error));

describe('registerGradeflowHandlers', () => {
  let ipc: FakeIpcMain;
  let service: jest.Mocked<Pick<GradeflowService, 'listSkills' | 'prepare' | 'confirm' | 'excludeFiles' | 'start' | 'cancel' | 'save' | 'discard'>>;
  let stored: GradeflowSettingsDto;
  let picks: [number, PickPathRequest][];
  let pickResult: string | null;
  let logged: string[];

  beforeEach(() => {
    ipc = new FakeIpcMain();
    service = {
      listSkills: jest.fn(),
      prepare: jest.fn(),
      confirm: jest.fn(),
      excludeFiles: jest.fn(),
      start: jest.fn(),
      cancel: jest.fn(),
      save: jest.fn(),
      discard: jest.fn(),
    };
    stored = { maxBudgetUsd: 3, timeoutMinutes: 15 };
    picks = [];
    pickResult = '/picked';
    logged = [];
    registerGradeflowHandlers(ipc, {
      service,
      pickPath: async (senderId, request) => {
        picks.push([senderId, request]);
        return pickResult;
      },
      settings: { get: () => stored, set: (value) => (stored = value) },
      logError: (message) => logged.push(message),
    });
  });

  it('registers a handler for every channel except the push channel', () => {
    const expected = Object.entries(IPC)
      .filter(([key]) => key.startsWith('GRADEFLOW_') && key !== 'GRADEFLOW_PROGRESS')
      .map(([, channel]) => channel);

    expect(ipc.channels().sort()).toEqual([...expected].sort());
  });

  describe('listSkills', () => {
    it('returns the skills', async () => {
      service.listSkills.mockResolvedValue({ skills: [], invalid: [] });

      expect(await ipc.invoke(IPC.GRADEFLOW_LIST_SKILLS)).toEqual({ ok: true, value: { skills: [], invalid: [] } });
    });
  });

  describe('validated calls', () => {
    const prepare = {
      courseId: 'c',
      assessmentId: 'a',
      handinsDir: '/in',
      assignmentPath: '/in/a.pdf',
      solutionPath: null,
      skillId: 's',
    };

    it('passes the validated payload to the service and wraps the value', async () => {
      service.prepare.mockReturnValue(ok({ runId: 'r' } as never));

      const result = await ipc.invoke(IPC.GRADEFLOW_PREPARE, { ...prepare, extra: 'dropped' });

      expect(result).toEqual({ ok: true, value: { runId: 'r' } });
      expect(service.prepare).toHaveBeenCalledWith(prepare);
    });

    it('answers invalid payloads without calling the service', async () => {
      const result = (await ipc.invoke(IPC.GRADEFLOW_PREPARE, { ...prepare, courseId: '' })) as { ok: boolean; error: { name: string } };

      expect(result.ok).toBe(false);
      expect(result.error.name).toBe('ValidationError');
      expect(service.prepare).not.toHaveBeenCalled();
    });

    it('translates domain errors', async () => {
      service.confirm.mockReturnValue(fail(new NotFoundError('Gradeflow run', 'r')));

      expect(await ipc.invoke(IPC.GRADEFLOW_CONFIRM, { runId: 'r', overrides: [] })).toEqual({
        ok: false,
        error: { name: 'NotFoundError', message: 'Gradeflow run with id r not found' },
      });
    });

    it('delivers confirm, excludeFiles, cancel and discard to the service', async () => {
      service.confirm.mockReturnValue(ok({ handinCount: 1, report: [] }));
      service.excludeFiles.mockReturnValue(ok(undefined as void));
      service.cancel.mockReturnValue(ok(undefined as void));
      service.discard.mockReturnValue(ok(undefined as void));

      await ipc.invoke(IPC.GRADEFLOW_CONFIRM, { runId: 'r', overrides: [{ moodleId: '1', studentId: null }] });
      await ipc.invoke(IPC.GRADEFLOW_EXCLUDE_FILES, { runId: 'r', files: [{ studentId: 's', path: 'a' }] });
      await ipc.invoke(IPC.GRADEFLOW_CANCEL, { runId: 'r' });
      await ipc.invoke(IPC.GRADEFLOW_DISCARD, { runId: 'r' });

      expect(service.confirm).toHaveBeenCalledWith('r', [{ moodleId: '1', studentId: null }]);
      expect(service.excludeFiles).toHaveBeenCalledWith('r', [{ studentId: 's', path: 'a' }]);
      expect(service.cancel).toHaveBeenCalledWith('r');
      expect(service.discard).toHaveBeenCalledWith('r');
    });

    it('does not leak the message of an unexpected exception and logs the call', async () => {
      service.cancel.mockRejectedValue(new Error('boom for Max Mustermann'));

      const result = await ipc.invoke(IPC.GRADEFLOW_CANCEL, { runId: 'r' });

      expect(result).toEqual({ ok: false, error: { name: 'InternalError', message: 'Internal error' } });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain(IPC.GRADEFLOW_CANCEL);
      expect(logged[0]).not.toContain('Mustermann');
    });
  });

  describe('start', () => {
    it('resolves when the run ends and pushes progress to the sender', async () => {
      const { event, sent } = aSender();
      service.start.mockImplementation(async (_runId, onProgress) => {
        onProgress({ kind: 'started', model: 'sonnet' });
        onProgress({ kind: 'reading', studentId: 's-1' });
        return Result.ok({ rows: [], missingStudentIds: [], costUsd: 1, durationMs: 2 });
      });

      const result = await ipc.invoke(IPC.GRADEFLOW_START, { runId: 'r' }, event);

      expect(result).toEqual({ ok: true, value: { rows: [], missingStudentIds: [], costUsd: 1, durationMs: 2 } });
      expect(sent).toEqual([
        [IPC.GRADEFLOW_PROGRESS, { runId: 'r', event: { kind: 'started', model: 'sonnet' } }],
        [IPC.GRADEFLOW_PROGRESS, { runId: 'r', event: { kind: 'reading', studentId: 's-1' } }],
      ]);
    });

    it('does not push to a sender that is gone', async () => {
      const { event, sent } = aSender(true);
      service.start.mockImplementation(async (_runId, onProgress) => {
        onProgress({ kind: 'finished' });
        return Result.ok({ rows: [], missingStudentIds: [], costUsd: null, durationMs: 0 });
      });

      await ipc.invoke(IPC.GRADEFLOW_START, { runId: 'r' }, event);

      expect(sent).toEqual([]);
    });

    it('reports the code of an agent failure', async () => {
      service.start.mockReturnValue(fail(new AgentRunError('NOT_LOGGED_IN', 'Not signed in')));

      expect(await ipc.invoke(IPC.GRADEFLOW_START, { runId: 'r' })).toEqual({
        ok: false,
        error: { name: 'AgentRunError', message: 'Not signed in', code: 'NOT_LOGGED_IN' },
      });
    });
  });

  describe('save', () => {
    const payload = { runId: 'r', rows: [{ studentId: 's', symbol: 'PLUS', comment: 'x', include: true }], overwriteConfirmed: false };

    it('passes rows and the confirmation flag on', async () => {
      service.save.mockReturnValue(ok({ saved: 1, failed: [] }));

      expect(await ipc.invoke(IPC.GRADEFLOW_SAVE, payload)).toEqual({ ok: true, value: { saved: 1, failed: [] } });
      expect(service.save).toHaveBeenCalledWith('r', payload.rows, false);
    });

    it('tells how many results need a confirmation', async () => {
      service.save.mockReturnValue(fail(new OverwriteNeedsConfirmationError(3)));

      expect(await ipc.invoke(IPC.GRADEFLOW_SAVE, payload)).toEqual({
        ok: false,
        error: { name: 'OverwriteNeedsConfirmationError', message: '3 existing result(s) would be replaced', count: 3 },
      });
    });

    it('translates plain validation errors without extras', async () => {
      service.save.mockReturnValue(fail(new ValidationError('nope')));

      expect(await ipc.invoke(IPC.GRADEFLOW_SAVE, payload)).toEqual({ ok: false, error: { name: 'ValidationError', message: 'nope' } });
    });
  });

  describe('pickPath', () => {
    it('asks for the window of the sender and returns the path', async () => {
      const result = await ipc.invoke(IPC.GRADEFLOW_PICK_PATH, { kind: 'directory', title: 'Abgaben' });

      expect(result).toEqual({ ok: true, value: '/picked' });
      expect(picks).toEqual([[7, { kind: 'directory', title: 'Abgaben' }]]);
    });

    it('returns null when the dialog was cancelled and rejects invalid requests', async () => {
      pickResult = null;
      expect(await ipc.invoke(IPC.GRADEFLOW_PICK_PATH, { kind: 'file', title: 'Aufgabe' })).toEqual({ ok: true, value: null });

      const invalid = (await ipc.invoke(IPC.GRADEFLOW_PICK_PATH, { kind: 'x', title: '' })) as { ok: boolean };
      expect(invalid.ok).toBe(false);
      expect(picks).toHaveLength(1);
    });
  });

  describe('settings', () => {
    it('returns the stored settings', async () => {
      expect(await ipc.invoke(IPC.GRADEFLOW_GET_SETTINGS)).toEqual({ ok: true, value: { maxBudgetUsd: 3, timeoutMinutes: 15 } });
    });

    it('stores valid settings and echoes them', async () => {
      const result = await ipc.invoke(IPC.GRADEFLOW_SET_SETTINGS, { maxBudgetUsd: 10, timeoutMinutes: 30 });

      expect(result).toEqual({ ok: true, value: { maxBudgetUsd: 10, timeoutMinutes: 30 } });
      expect(stored).toEqual({ maxBudgetUsd: 10, timeoutMinutes: 30 });
    });

    it('refuses settings outside the limits', async () => {
      const result = (await ipc.invoke(IPC.GRADEFLOW_SET_SETTINGS, { maxBudgetUsd: 500, timeoutMinutes: 30 })) as { ok: boolean };

      expect(result.ok).toBe(false);
      expect(stored).toEqual({ maxBudgetUsd: 3, timeoutMinutes: 15 });
    });
  });
});
