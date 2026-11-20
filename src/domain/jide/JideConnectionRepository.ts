/** The J;DE server address and the API key, which is already encrypted: the repository never sees plain text. */
export interface StoredJideConnection {
  baseUrl: string;
  encryptedKey: Uint8Array;
}

export interface JideConnectionRepository {
  get(): Promise<StoredJideConnection | null>;
  /** Replaces the connection; `encryptedKey` null keeps the stored key (and does nothing without one). */
  save(baseUrl: string, encryptedKey: Uint8Array | null, updatedAt: Date): Promise<void>;
  clear(): Promise<void>;
}
