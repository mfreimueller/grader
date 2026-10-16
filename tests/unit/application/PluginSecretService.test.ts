import { PluginCaller, PluginPermissionDeniedError } from '../../../src/application/PluginCaller';
import { MAX_SECRET_BYTES, PluginSecretService } from '../../../src/application/PluginSecretService';
import type { PluginId } from '../../../src/domain/plugin/PluginId';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import type { PluginSecretRepository } from '../../../src/domain/plugin/PluginSecretRepository';
import type { SecretCipher } from '../../../src/domain/plugin/SecretCipher';
import type { Result } from '../../../src/domain/shared/Result';
import { ValidationError } from '../../../src/shared/errors';

const aCaller = (overrides: { id?: string; permissions?: string[] } = {}): PluginCaller => {
  const manifest = PluginManifest.create({
    id: overrides.id ?? 'at.example.tool',
    name: 'Tool',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: overrides.permissions ?? ['secrets'],
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return { manifest: manifest.value, courseId: 'course-1' };
};

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

/** Reverses the text so that a stored value is visibly not the plain one. */
class FakeCipher implements SecretCipher {
  available = true;
  fail = false;
  isAvailable(): boolean {
    return this.available;
  }
  encrypt(plain: string): Uint8Array {
    return Buffer.from([...plain].reverse().join(''), 'utf8');
  }
  decrypt(data: Uint8Array): string {
    if (this.fail) throw new Error('cannot decrypt');
    return [...Buffer.from(data).toString('utf8')].reverse().join('');
  }
}

class FakeSecretRepository implements PluginSecretRepository {
  readonly rows = new Map<string, Uint8Array>();
  private id = (pluginId: PluginId, key: string): string => `${pluginId.value}|${key}`;
  get(pluginId: PluginId, key: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.rows.get(this.id(pluginId, key)) ?? null);
  }
  set(pluginId: PluginId, key: string, value: Uint8Array): Promise<void> {
    this.rows.set(this.id(pluginId, key), value);
    return Promise.resolve();
  }
  delete(pluginId: PluginId, key: string): Promise<void> {
    this.rows.delete(this.id(pluginId, key));
    return Promise.resolve();
  }
  deleteAllOf(pluginId: PluginId): Promise<void> {
    for (const row of [...this.rows.keys()]) if (row.startsWith(`${pluginId.value}|`)) this.rows.delete(row);
    return Promise.resolve();
  }
}

describe('PluginSecretService', () => {
  let repo: FakeSecretRepository;
  let cipher: FakeCipher;
  let service: PluginSecretService;

  beforeEach(() => {
    repo = new FakeSecretRepository();
    cipher = new FakeCipher();
    service = new PluginSecretService(repo, cipher, () => new Date('2026-10-14T10:00:00.000Z'));
  });

  it('stores a secret and reads it back', async () => {
    valueOf(await service.set(aCaller(), 'token', 'ghp_abc'));

    expect(valueOf(await service.get(aCaller(), 'token'))).toBe('ghp_abc');
  });

  it('never stores the plain text', async () => {
    await service.set(aCaller(), 'token', 'ghp_abc');

    const stored = [...repo.rows.values()].map((row) => Buffer.from(row).toString('utf8'));
    expect(stored).toEqual(['cba_phg']);
  });

  it('returns null for a secret that was never stored', async () => {
    expect(valueOf(await service.get(aCaller(), 'token'))).toBeNull();
  });

  it('replaces a secret and deletes it', async () => {
    await service.set(aCaller(), 'token', 'one');
    await service.set(aCaller(), 'token', 'two');
    expect(valueOf(await service.get(aCaller(), 'token'))).toBe('two');

    valueOf(await service.delete(aCaller(), 'token'));

    expect(valueOf(await service.get(aCaller(), 'token'))).toBeNull();
  });

  it('keeps the secrets of different plugins apart', async () => {
    await service.set(aCaller({ id: 'at.example.tool' }), 'token', 'mine');

    expect(valueOf(await service.get(aCaller({ id: 'at.example.other' }), 'token'))).toBeNull();
  });

  describe('permission', () => {
    it.each([
      ['get', (s: PluginSecretService, c: PluginCaller) => s.get(c, 'token')],
      ['set', (s: PluginSecretService, c: PluginCaller) => s.set(c, 'token', 'x')],
      ['delete', (s: PluginSecretService, c: PluginCaller) => s.delete(c, 'token')],
    ])('refuses %s without the secrets permission', async (_label, call) => {
      const result = await call(service, aCaller({ permissions: ['storage'] }));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(PluginPermissionDeniedError);
      expect(repo.rows.size).toBe(0);
    });
  });

  describe('when the system cannot encrypt', () => {
    beforeEach(() => {
      cipher.available = false;
    });

    it('refuses to store a secret instead of writing it in plain text', async () => {
      const result = await service.set(aCaller(), 'token', 'ghp_abc');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toMatch(/encrypt|secure/i);
      }
      expect(repo.rows.size).toBe(0);
    });

    it('still lets the plugin delete a secret and find that there is none', async () => {
      expect(valueOf(await service.get(aCaller(), 'token'))).toBeNull();
      expect((await service.delete(aCaller(), 'token')).ok).toBe(true);
    });

    it('refuses to read a stored secret', async () => {
      cipher.available = true;
      await service.set(aCaller(), 'token', 'x');
      cipher.available = false;

      expect((await service.get(aCaller(), 'token')).ok).toBe(false);
    });
  });

  it('explains a secret that cannot be decrypted, e.g. from a backup of another machine', async () => {
    await service.set(aCaller(), 'token', 'x');
    cipher.fail = true;

    const result = await service.get(aCaller(), 'token');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toMatch(/this computer|this machine/i);
    }
  });

  describe('validation', () => {
    it.each(['', 'a b', 'a/b', 'x'.repeat(129), 'ü'])('rejects the key %p', async (key) => {
      expect((await service.set(aCaller(), key, 'x')).ok).toBe(false);
      expect((await service.get(aCaller(), key)).ok).toBe(false);
      expect((await service.delete(aCaller(), key)).ok).toBe(false);
    });

    it.each([
      ['a number', 5],
      ['an object', { a: 1 }],
      ['undefined', undefined],
      ['null', null],
      ['an empty string', ''],
    ])('rejects %s as a value', async (_label, value) => {
      expect((await service.set(aCaller(), 'token', value)).ok).toBe(false);
      expect(repo.rows.size).toBe(0);
    });

    it('accepts a value of the maximum size and rejects a larger one', async () => {
      expect((await service.set(aCaller(), 'token', 'x'.repeat(MAX_SECRET_BYTES))).ok).toBe(true);
      expect((await service.set(aCaller(), 'token', 'x'.repeat(MAX_SECRET_BYTES + 1))).ok).toBe(false);
    });
  });
});
