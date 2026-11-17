import type { PluginCaller } from '../../../src/application/PluginCaller';
import { NotInCourseError } from '../../../src/application/PluginCaller';
import type { PluginHostService } from '../../../src/application/PluginHostService';
import type { PluginSecretService } from '../../../src/application/PluginSecretService';
import type { PluginStorageService } from '../../../src/application/PluginStorageService';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import { Result } from '../../../src/domain/shared/Result';
import { IPC } from '../../../src/shared/ipc-channels';
import { registerPluginHostHandlers } from '../../../src/main/ipc/pluginHost.ipc';
import type { IpcMainLike } from '../../../src/main/ipc/pluginHost.ipc';
import { PluginWindowRegistry } from '../../../src/main/plugins/PluginWindowRegistry';

const PLUGIN_SENDER = 7;
const MAIN_WINDOW_SENDER = 1;

const aCaller = (courseId = 'course-1'): PluginCaller => {
  const manifest = PluginManifest.create({
    id: 'at.example.tool',
    name: 'Tool',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: ['course:read', 'storage', 'assessment:impromptu', 'secrets'],
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return { manifest: manifest.value, courseId };
};

class FakeIpcMain implements IpcMainLike {
  private readonly handlers = new Map<string, Parameters<IpcMainLike['handle']>[1]>();
  handle(channel: string, listener: Parameters<IpcMainLike['handle']>[1]): void {
    this.handlers.set(channel, listener);
  }
  channels(): string[] {
    return [...this.handlers.keys()];
  }
  invoke(channel: string, senderId: number, payload?: unknown): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return handler({ sender: { id: senderId } }, payload);
  }
}

const ok = <T>(value: T): Promise<Result<T>> => Promise.resolve(Result.ok(value));

describe('registerPluginHostHandlers', () => {
  let ipc: FakeIpcMain;
  let host: jest.Mocked<Pick<PluginHostService, 'context' | 'listAssessments' | 'createImpromptu' | 'deleteImpromptu' | 'setImpromptuNote'>>;
  let storage: jest.Mocked<Pick<PluginStorageService, 'get' | 'set' | 'delete' | 'keys'>>;
  let secrets: jest.Mocked<Pick<PluginSecretService, 'get' | 'set' | 'delete'>>;
  let changed: string[];
  let logged: unknown[];
  const caller = aCaller();

  beforeEach(() => {
    ipc = new FakeIpcMain();
    host = {
      context: jest.fn(),
      listAssessments: jest.fn(),
      createImpromptu: jest.fn(),
      deleteImpromptu: jest.fn(),
      setImpromptuNote: jest.fn(),
    };
    storage = { get: jest.fn(), set: jest.fn(), delete: jest.fn(), keys: jest.fn() };
    secrets = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
    changed = [];
    logged = [];
    const registry = new PluginWindowRegistry<unknown>();
    registry.register(PLUGIN_SENDER, caller, {});

    registerPluginHostHandlers(ipc, {
      registry,
      host,
      storage,
      secrets,
      onDataChanged: (courseId) => changed.push(courseId),
      logError: (message, error) => logged.push([message, error]),
    });
  });

  it('handles every bridge channel', () => {
    expect(ipc.channels().sort()).toEqual(
      [
        IPC.PLUGIN_HOST_CONTEXT,
        IPC.PLUGIN_HOST_LIST_ASSESSMENTS,
        IPC.PLUGIN_HOST_STORAGE_GET,
        IPC.PLUGIN_HOST_STORAGE_SET,
        IPC.PLUGIN_HOST_STORAGE_DELETE,
        IPC.PLUGIN_HOST_STORAGE_KEYS,
        IPC.PLUGIN_HOST_CREATE_IMPROMPTU,
        IPC.PLUGIN_HOST_DELETE_IMPROMPTU,
        IPC.PLUGIN_HOST_SET_IMPROMPTU_NOTE,
        IPC.PLUGIN_HOST_SECRETS_GET,
        IPC.PLUGIN_HOST_SECRETS_SET,
        IPC.PLUGIN_HOST_SECRETS_DELETE,
      ].sort(),
    );
  });

  describe('who may call', () => {
    it.each([
      [IPC.PLUGIN_HOST_CONTEXT, undefined],
      [IPC.PLUGIN_HOST_LIST_ASSESSMENTS, undefined],
      [IPC.PLUGIN_HOST_STORAGE_GET, { scope: 'course', key: 'k' }],
      [IPC.PLUGIN_HOST_STORAGE_SET, { scope: 'course', key: 'k', value: 1 }],
      [IPC.PLUGIN_HOST_STORAGE_DELETE, { scope: 'course', key: 'k' }],
      [IPC.PLUGIN_HOST_STORAGE_KEYS, { scope: 'course' }],
      [IPC.PLUGIN_HOST_CREATE_IMPROMPTU, { studentId: 's', categoryId: 'c' }],
      [IPC.PLUGIN_HOST_DELETE_IMPROMPTU, { assessmentId: 'a' }],
      [IPC.PLUGIN_HOST_SET_IMPROMPTU_NOTE, { assessmentId: 'a', note: 'n' }],
      [IPC.PLUGIN_HOST_SECRETS_GET, { key: 'k' }],
      [IPC.PLUGIN_HOST_SECRETS_SET, { key: 'k', value: 'v' }],
      [IPC.PLUGIN_HOST_SECRETS_DELETE, { key: 'k' }],
    ])('refuses %s for a window that is not a plugin, such as the main window', async (channel, payload) => {
      const result = await ipc.invoke(channel, MAIN_WINDOW_SENDER, payload);

      expect(result).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED', message: 'Not a plugin window' } });
      expect(host.context).not.toHaveBeenCalled();
      expect(host.listAssessments).not.toHaveBeenCalled();
      expect(host.createImpromptu).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(secrets.get).not.toHaveBeenCalled();
      expect(secrets.set).not.toHaveBeenCalled();
      expect(secrets.delete).not.toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('serves the context for the plugin and course of the sender', async () => {
      host.context.mockReturnValue(ok({ course: { id: 'course-1' } } as never));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_CONTEXT, PLUGIN_SENDER);

      expect(host.context).toHaveBeenCalledWith(caller);
      expect(result).toEqual({ ok: true, value: { course: { id: 'course-1' } } });
    });
  });

  describe('listAssessments', () => {
    it('lists the assessments of the course of the sender without announcing a change', async () => {
      host.listAssessments.mockReturnValue(ok([{ id: 'a-1' }] as never));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_LIST_ASSESSMENTS, PLUGIN_SENDER);

      expect(host.listAssessments).toHaveBeenCalledWith(caller);
      expect(result).toEqual({ ok: true, value: [{ id: 'a-1' }] });
      expect(changed).toEqual([]);
    });
  });

  describe('storage', () => {
    it('reads a key in the requested scope', async () => {
      storage.get.mockReturnValue(ok({ a: 1 }));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_GET, PLUGIN_SENDER, { scope: 'global', key: 'counts' });

      expect(storage.get).toHaveBeenCalledWith(caller, 'global', 'counts');
      expect(result).toEqual({ ok: true, value: { a: 1 } });
    });

    it('writes a value, which may be any JSON', async () => {
      storage.set.mockReturnValue(ok(undefined as void));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_SET, PLUGIN_SENDER, {
        scope: 'course',
        key: 'counts',
        value: { 's-1': 2 },
      });

      expect(storage.set).toHaveBeenCalledWith(caller, 'course', 'counts', { 's-1': 2 });
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('hands a missing value on to the service, which rejects it', async () => {
      storage.set.mockReturnValue(ok(undefined as void));

      await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_SET, PLUGIN_SENDER, { scope: 'course', key: 'k' });

      expect(storage.set).toHaveBeenCalledWith(caller, 'course', 'k', undefined);
    });

    it('deletes a key', async () => {
      storage.delete.mockReturnValue(ok(undefined as void));

      await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_DELETE, PLUGIN_SENDER, { scope: 'course', key: 'k' });

      expect(storage.delete).toHaveBeenCalledWith(caller, 'course', 'k');
    });

    it('lists keys with and without a prefix', async () => {
      storage.keys.mockReturnValue(ok(['pick:a']));

      await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_KEYS, PLUGIN_SENDER, { scope: 'course', prefix: 'pick:' });
      await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_KEYS, PLUGIN_SENDER, { scope: 'global' });

      expect(storage.keys).toHaveBeenNthCalledWith(1, caller, 'course', 'pick:');
      expect(storage.keys).toHaveBeenNthCalledWith(2, caller, 'global', undefined);
    });

    it.each([
      ['an unknown scope', IPC.PLUGIN_HOST_STORAGE_GET, { scope: 'everywhere', key: 'k' }],
      ['a missing scope', IPC.PLUGIN_HOST_STORAGE_GET, { key: 'k' }],
      ['a key that is not a string', IPC.PLUGIN_HOST_STORAGE_GET, { scope: 'course', key: 5 }],
      ['no payload', IPC.PLUGIN_HOST_STORAGE_SET, undefined],
      ['a payload that is not an object', IPC.PLUGIN_HOST_STORAGE_DELETE, 'k'],
      ['a prefix that is not a string', IPC.PLUGIN_HOST_STORAGE_KEYS, { scope: 'course', prefix: 1 }],
    ])('rejects %s without calling the service', async (_label, channel, payload) => {
      const result = (await ipc.invoke(channel, PLUGIN_SENDER, payload)) as { ok: boolean; error: { code: string } };

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION');
      expect(storage.get).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
      expect(storage.keys).not.toHaveBeenCalled();
    });

    it('does not tell the other windows that data changed', async () => {
      storage.set.mockReturnValue(ok(undefined as void));

      await ipc.invoke(IPC.PLUGIN_HOST_STORAGE_SET, PLUGIN_SENDER, { scope: 'course', key: 'k', value: 1 });

      expect(changed).toEqual([]);
    });
  });

  describe('secrets', () => {
    it('reads, writes and deletes a secret of the plugin of the sender', async () => {
      secrets.get.mockReturnValue(ok('ghp_abc'));
      secrets.set.mockReturnValue(ok(undefined as void));
      secrets.delete.mockReturnValue(ok(undefined as void));

      const read = await ipc.invoke(IPC.PLUGIN_HOST_SECRETS_GET, PLUGIN_SENDER, { key: 'token' });
      await ipc.invoke(IPC.PLUGIN_HOST_SECRETS_SET, PLUGIN_SENDER, { key: 'token', value: 'ghp_abc' });
      await ipc.invoke(IPC.PLUGIN_HOST_SECRETS_DELETE, PLUGIN_SENDER, { key: 'token' });

      expect(read).toEqual({ ok: true, value: 'ghp_abc' });
      expect(secrets.get).toHaveBeenCalledWith(caller, 'token');
      expect(secrets.set).toHaveBeenCalledWith(caller, 'token', 'ghp_abc');
      expect(secrets.delete).toHaveBeenCalledWith(caller, 'token');
    });

    it.each([
      ['a missing key', IPC.PLUGIN_HOST_SECRETS_GET, {}],
      ['a key that is not a string', IPC.PLUGIN_HOST_SECRETS_DELETE, { key: 1 }],
      ['no payload', IPC.PLUGIN_HOST_SECRETS_SET, undefined],
    ])('rejects %s without calling the service', async (_label, channel, payload) => {
      const result = (await ipc.invoke(channel, PLUGIN_SENDER, payload)) as { ok: boolean; error: { code: string } };

      expect(result.error.code).toBe('VALIDATION');
      expect(secrets.get).not.toHaveBeenCalled();
      expect(secrets.set).not.toHaveBeenCalled();
      expect(secrets.delete).not.toHaveBeenCalled();
    });

    it('hands a value that is not a string on to the service, which rejects it', async () => {
      secrets.set.mockReturnValue(ok(undefined as void));

      await ipc.invoke(IPC.PLUGIN_HOST_SECRETS_SET, PLUGIN_SENDER, { key: 'token', value: 5 });

      expect(secrets.set).toHaveBeenCalledWith(caller, 'token', 5);
    });

    it('does not log the secret when the service fails unexpectedly', async () => {
      secrets.set.mockRejectedValue(new Error('disk full'));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_SECRETS_SET, PLUGIN_SENDER, { key: 'token', value: 'ghp_abc' });

      expect(result).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Internal error' } });
      expect(JSON.stringify(logged)).not.toContain('ghp_abc');
    });
  });

  describe('setImpromptuNote', () => {
    it('passes the note on and tells Grader the course changed', async () => {
      host.setImpromptuNote.mockReturnValue(ok(undefined as void));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_SET_IMPROMPTU_NOTE, PLUGIN_SENDER, { assessmentId: 'a-1', note: 'Brüche' });

      expect(host.setImpromptuNote).toHaveBeenCalledWith(caller, 'a-1', 'Brüche');
      expect(result).toEqual({ ok: true, value: undefined });
      expect(changed).toEqual(['course-1']);
    });

    it.each([
      ['a missing note', { assessmentId: 'a-1' }],
      ['a note that is not a string', { assessmentId: 'a-1', note: 5 }],
      ['a missing assessment', { note: 'x' }],
    ])('rejects %s without calling the service', async (_label, payload) => {
      const result = (await ipc.invoke(IPC.PLUGIN_HOST_SET_IMPROMPTU_NOTE, PLUGIN_SENDER, payload)) as {
        error: { code: string };
      };

      expect(result.error.code).toBe('VALIDATION');
      expect(host.setImpromptuNote).not.toHaveBeenCalled();
    });
  });

  describe('createImpromptu', () => {
    const created = { assessmentId: 'a-1', performanceId: 'p-1', sessionId: 'se-1' };

    it('passes the request on and tells Grader the course changed', async () => {
      host.createImpromptu.mockReturnValue(ok(created));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, PLUGIN_SENDER, {
        studentId: 's-1',
        categoryId: 'cat-1',
        symbol: 'PLUS',
        session: { kind: 'date', date: '2026-09-30' },
        title: 'Wortmeldung',
        note: 'Brüche',
      });

      expect(host.createImpromptu).toHaveBeenCalledWith(caller, {
        studentId: 's-1',
        categoryId: 'cat-1',
        symbol: 'PLUS',
        session: { kind: 'date', date: '2026-09-30' },
        title: 'Wortmeldung',
        note: 'Brüche',
      });
      expect(result).toEqual({ ok: true, value: created });
      expect(changed).toEqual(['course-1']);
    });

    it('takes the course from the window, whatever the plugin claims', async () => {
      host.createImpromptu.mockReturnValue(ok(created));

      await ipc.invoke(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, PLUGIN_SENDER, {
        studentId: 's-1',
        categoryId: 'cat-1',
        courseId: 'course-2',
        pluginId: 'at.example.other',
      });

      expect(host.createImpromptu).toHaveBeenCalledWith(caller, { studentId: 's-1', categoryId: 'cat-1' });
      expect(changed).toEqual(['course-1']);
    });

    it('does not announce a change when the request failed', async () => {
      host.createImpromptu.mockReturnValue(Promise.resolve(Result.fail(new NotInCourseError('Student', 's-9'))));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, PLUGIN_SENDER, {
        studentId: 's-9',
        categoryId: 'cat-1',
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'NOT_IN_COURSE', message: 'Student s-9 does not belong to this course' },
      });
      expect(changed).toEqual([]);
    });

    it.each([
      ['no payload', undefined],
      ['a missing student', { categoryId: 'c' }],
      ['an empty student', { studentId: '', categoryId: 'c' }],
      ['a missing category', { studentId: 's' }],
      ['a score that is a string', { studentId: 's', categoryId: 'c', score: '5' }],
      ['an unknown session kind', { studentId: 's', categoryId: 'c', session: { kind: 'yesterday' } }],
      ['a date target without a date', { studentId: 's', categoryId: 'c', session: { kind: 'date' } }],
      ['a session target without an id', { studentId: 's', categoryId: 'c', session: { kind: 'session' } }],
      ['a symbol that is a number', { studentId: 's', categoryId: 'c', symbol: 1 }],
    ])('rejects %s without calling the service', async (_label, payload) => {
      const result = (await ipc.invoke(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, PLUGIN_SENDER, payload)) as {
        ok: boolean;
        error: { code: string };
      };

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION');
      expect(host.createImpromptu).not.toHaveBeenCalled();
      expect(changed).toEqual([]);
    });
  });

  describe('deleteImpromptu', () => {
    it('deletes and tells Grader the course changed', async () => {
      host.deleteImpromptu.mockReturnValue(ok(undefined as void));

      const result = await ipc.invoke(IPC.PLUGIN_HOST_DELETE_IMPROMPTU, PLUGIN_SENDER, { assessmentId: 'a-1' });

      expect(host.deleteImpromptu).toHaveBeenCalledWith(caller, 'a-1');
      expect(result).toEqual({ ok: true, value: undefined });
      expect(changed).toEqual(['course-1']);
    });

    it.each([undefined, {}, { assessmentId: '' }, { assessmentId: 7 }])('rejects the payload %p', async (payload) => {
      const result = (await ipc.invoke(IPC.PLUGIN_HOST_DELETE_IMPROMPTU, PLUGIN_SENDER, payload)) as { ok: boolean };

      expect(result.ok).toBe(false);
      expect(host.deleteImpromptu).not.toHaveBeenCalled();
    });
  });

  describe('unexpected failures', () => {
    it('answers INTERNAL without the details and logs the cause', async () => {
      const cause = new Error('SQLITE_BUSY: database is locked, /Users/x/grdr.db');
      host.context.mockRejectedValue(cause);

      const result = await ipc.invoke(IPC.PLUGIN_HOST_CONTEXT, PLUGIN_SENDER);

      expect(result).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Internal error' } });
      expect(logged).toEqual([[`Plugin bridge call ${IPC.PLUGIN_HOST_CONTEXT} failed`, cause]]);
    });

    it('does not announce a change when a write blew up', async () => {
      host.createImpromptu.mockRejectedValue(new Error('boom'));

      await ipc.invoke(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, PLUGIN_SENDER, { studentId: 's', categoryId: 'c' });

      expect(changed).toEqual([]);
    });
  });
});
