import type { JideConnectionService } from '../../../src/application/JideConnectionService';
import { JideApiError } from '../../../src/domain/jide/JideApi';
import { Result } from '../../../src/domain/shared/Result';
import { ValidationError } from '../../../src/shared/errors';
import { IPC } from '../../../src/shared/ipc-channels';
import { registerJideHandlers } from '../../../src/main/ipc/jide.ipc';
import type { JideIpcMain } from '../../../src/main/ipc/jide.ipc';

class FakeIpcMain implements JideIpcMain {
  private readonly handlers = new Map<string, Parameters<JideIpcMain['handle']>[1]>();
  handle(channel: string, listener: Parameters<JideIpcMain['handle']>[1]): void {
    this.handlers.set(channel, listener);
  }
  invoke(channel: string, payload?: unknown): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return handler({}, payload);
  }
}

describe('registerJideHandlers', () => {
  let ipc: FakeIpcMain;
  let service: jest.Mocked<Pick<JideConnectionService, 'getSettings' | 'saveSettings' | 'clearSettings' | 'test' | 'linkOverview' | 'saveLinks' | 'exercisesOf'>>;
  let logged: string[];

  beforeEach(() => {
    ipc = new FakeIpcMain();
    logged = [];
    service = {
      getSettings: jest.fn(),
      saveSettings: jest.fn(),
      clearSettings: jest.fn(),
      test: jest.fn(),
      linkOverview: jest.fn(),
      saveLinks: jest.fn(),
      exercisesOf: jest.fn(),
    };
    registerJideHandlers(ipc, { service, logError: (m) => logged.push(m) });
  });

  it('returns the settings without a key', async () => {
    service.getSettings.mockResolvedValue({ baseUrl: 'https://x', hasKey: true, encryptionAvailable: true });
    expect(await ipc.invoke(IPC.JIDE_GET_SETTINGS)).toEqual({
      ok: true,
      value: { baseUrl: 'https://x', hasKey: true, encryptionAvailable: true },
    });
  });

  it('validates the settings payload and drops unknown fields', async () => {
    service.saveSettings.mockResolvedValue(Result.ok({ baseUrl: 'https://x', hasKey: true, encryptionAvailable: true }));
    await ipc.invoke(IPC.JIDE_SET_SETTINGS, { baseUrl: 'https://x', apiKey: 'jide_abcd', extra: 1 });
    expect(service.saveSettings).toHaveBeenCalledWith({ baseUrl: 'https://x', apiKey: 'jide_abcd' });
    expect(await ipc.invoke(IPC.JIDE_SET_SETTINGS, { baseUrl: 5 })).toMatchObject({ ok: false, error: { name: 'ValidationError' } });
  });

  it('passes the optional J;DE course of the overview through', async () => {
    service.linkOverview.mockResolvedValue(Result.fail(new ValidationError('x')));
    await ipc.invoke(IPC.JIDE_LINK_OVERVIEW, { courseId: 'c', jideCourseId: null });
    await ipc.invoke(IPC.JIDE_LINK_OVERVIEW, { courseId: 'c' });
    expect(service.linkOverview.mock.calls).toEqual([['c', null], ['c', undefined]]);
  });

  it('turns a failed result into a plain error with the server message', async () => {
    service.test.mockResolvedValue(Result.fail(new JideApiError('J;DE ist nicht erreichbar.', 0)));
    expect(await ipc.invoke(IPC.JIDE_TEST, { baseUrl: 'https://x', apiKey: '' })).toEqual({
      ok: false,
      error: { name: 'JideApiError', message: 'J;DE ist nicht erreichbar.' },
    });
  });

  it('logs only the error name when a handler throws', async () => {
    service.exercisesOf.mockRejectedValue(new Error('jide_secret in message'));
    expect(await ipc.invoke(IPC.JIDE_LIST_EXERCISES, { courseId: 'c' })).toEqual({
      ok: false,
      error: { name: 'InternalError', message: 'Es ist ein interner Fehler aufgetreten.' },
    });
    expect(logged).toEqual([`J;DE call ${IPC.JIDE_LIST_EXERCISES} failed: Error`]);
  });

  it('clears and returns the new settings', async () => {
    service.clearSettings.mockResolvedValue();
    service.getSettings.mockResolvedValue({ baseUrl: '', hasKey: false, encryptionAvailable: true });
    expect(await ipc.invoke(IPC.JIDE_CLEAR_SETTINGS)).toMatchObject({ ok: true, value: { hasKey: false } });
  });

  it('saves links', async () => {
    service.saveLinks.mockResolvedValue(Result.ok(undefined as void));
    const payload = { courseId: 'c', jideCourseId: '7', links: [{ studentId: 's', jideStudentId: '11' }] };
    expect(await ipc.invoke(IPC.JIDE_SAVE_LINKS, payload)).toEqual({ ok: true, value: undefined });
    expect(service.saveLinks).toHaveBeenCalledWith(payload);
  });
});
