import { PluginSecretRepository } from '../domain/plugin/PluginSecretRepository';
import { SecretCipher } from '../domain/plugin/SecretCipher';
import { Result } from '../domain/shared/Result';
import { ValidationError } from '../shared/errors';
import { PluginCaller, requirePermission } from './PluginCaller';

export const MAX_SECRET_BYTES = 16 * 1024;

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

/**
 * The secrets a plugin keeps, e.g. an access token. Plugin-global, not per course. Always encrypted: when the
 * system cannot encrypt, nothing is stored. The plugin id always comes from the caller.
 */
export class PluginSecretService {
  constructor(
    private readonly repo: PluginSecretRepository,
    private readonly cipher: SecretCipher,
    private readonly now: () => Date,
  ) {}

  /** The secret, or null when it is not set. */
  async get(caller: PluginCaller, key: string): Promise<Result<string | null>> {
    const allowed = this.check(caller, key);
    if (!allowed.ok) return Result.fail(allowed.error);

    const stored = await this.repo.get(caller.manifest.id, key);
    if (stored === null) return Result.ok(null);
    if (!this.cipher.isAvailable()) return Result.fail(new ValidationError(NOT_AVAILABLE));
    try {
      return Result.ok(this.cipher.decrypt(stored));
    } catch {
      return Result.fail(new ValidationError(CANNOT_DECRYPT));
    }
  }

  async set(caller: PluginCaller, key: string, value: unknown): Promise<Result<void>> {
    const allowed = this.check(caller, key);
    if (!allowed.ok) return Result.fail(allowed.error);
    if (typeof value !== 'string' || value.length === 0) {
      return Result.fail(new ValidationError('A secret must be a non-empty string'));
    }
    if (Buffer.byteLength(value, 'utf8') > MAX_SECRET_BYTES) {
      return Result.fail(new ValidationError(`A secret is limited to ${MAX_SECRET_BYTES / 1024} KiB`));
    }
    // Never fall back to plain text.
    if (!this.cipher.isAvailable()) return Result.fail(new ValidationError(NOT_AVAILABLE));

    await this.repo.set(caller.manifest.id, key, this.cipher.encrypt(value), this.now());
    return Result.ok(undefined as void);
  }

  async delete(caller: PluginCaller, key: string): Promise<Result<void>> {
    const allowed = this.check(caller, key);
    if (!allowed.ok) return Result.fail(allowed.error);

    await this.repo.delete(caller.manifest.id, key);
    return Result.ok(undefined as void);
  }

  private check(caller: PluginCaller, key: string): Result<void> {
    const allowed = requirePermission(caller, 'secrets');
    if (!allowed.ok) return allowed;
    if (!KEY_PATTERN.test(key)) {
      return Result.fail(new ValidationError('Key must be 1-128 characters of letters, digits and _ . : -'));
    }
    return Result.ok(undefined as void);
  }
}

const NOT_AVAILABLE = 'Secrets cannot be stored: this system offers no secure, encrypted storage';
const CANNOT_DECRYPT = 'The secret cannot be read on this computer, for example after a restore from another one; set it again';
