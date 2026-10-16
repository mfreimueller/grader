import { SafeStorageSecretCipher, type SafeStorageLike } from '../../../src/main/plugins/SafeStorageSecretCipher';

class FakeSafeStorage implements SafeStorageLike {
  available = true;
  isEncryptionAvailable(): boolean {
    return this.available;
  }
  encryptString(plain: string): Buffer {
    return Buffer.from(`enc:${plain}`, 'utf8');
  }
  decryptString(data: Buffer): string {
    const text = data.toString('utf8');
    if (!text.startsWith('enc:')) throw new Error('not encrypted for this user');
    return text.slice(4);
  }
}

describe('SafeStorageSecretCipher', () => {
  let storage: FakeSafeStorage;
  let cipher: SafeStorageSecretCipher;

  beforeEach(() => {
    storage = new FakeSafeStorage();
    cipher = new SafeStorageSecretCipher(storage);
  });

  it('reports whether the system can encrypt', () => {
    expect(cipher.isAvailable()).toBe(true);
    storage.available = false;
    expect(cipher.isAvailable()).toBe(false);
  });

  it('round-trips text through bytes that are not the plain text', () => {
    const encrypted = cipher.encrypt('ghp_abc');

    expect(Buffer.from(encrypted).toString('utf8')).not.toBe('ghp_abc');
    expect(cipher.decrypt(encrypted)).toBe('ghp_abc');
  });

  it('throws when the bytes cannot be decrypted here', () => {
    expect(() => cipher.decrypt(Uint8Array.from([1, 2, 3]))).toThrow();
  });

  it('refuses to encrypt when the system cannot, instead of returning plain text', () => {
    storage.available = false;

    expect(() => cipher.encrypt('ghp_abc')).toThrow(/not available/i);
  });
});
