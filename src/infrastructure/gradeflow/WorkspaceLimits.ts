export interface WorkspaceLimits {
  /** Largest file that is read, scrubbed and copied. */
  maxFileBytes: number;
  /** Most entries a single zip may contain. */
  maxArchiveEntries: number;
  /** Most uncompressed bytes a single zip may expand to. */
  maxArchiveBytes: number;
}

export const DEFAULT_WORKSPACE_LIMITS: WorkspaceLimits = {
  maxFileBytes: 2 * 1024 * 1024,
  maxArchiveEntries: 2000,
  maxArchiveBytes: 50 * 1024 * 1024,
};
