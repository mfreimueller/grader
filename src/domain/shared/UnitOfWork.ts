/** Runs several repository operations atomically: all of them take effect, or none. */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
