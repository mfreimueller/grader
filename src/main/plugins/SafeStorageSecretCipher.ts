import type { SecretCipher } from '../../domain/plugin/SecretCipher';

/** The part of Electron's `safeStorage` this adapter needs; lets it be tested without Electron. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(data: Buffer): string;
}

/** Encrypts with the operating system's key store (Keychain, DPAPI, libsecret) through Electron's safeStorage. */
export class SafeStorageSecretCipher implements SecretCipher {
  constructor(private readonly safeStorage: SafeStorageLike) {}

  isAvailable(): boolean {
    return this.safeStorage.isEncryptionAvailable();
  }

  encrypt(plain: string): Uint8Array {
    if (!this.isAvailable()) throw new Error('Encryption is not available on this system');
    return new Uint8Array(this.safeStorage.encryptString(plain));
  }

  decrypt(data: Uint8Array): string {
    return this.safeStorage.decryptString(Buffer.from(data));
  }
}
