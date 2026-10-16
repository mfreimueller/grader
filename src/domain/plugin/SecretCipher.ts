/**
 * Port: encrypts what a plugin keeps secret (an access token). The implementation uses the operating system's
 * key store, so the encrypted bytes only decrypt on the machine and for the user that wrote them.
 */
export interface SecretCipher {
  /** False when the system has no usable key store; nothing may be stored then. */
  isAvailable(): boolean;
  encrypt(plain: string): Uint8Array;
  /** Throws when the bytes were written on another machine or by another user. */
  decrypt(data: Uint8Array): string;
}
