/**
 * Message of the error a promise rejects with, or null if it resolves.
 *
 * Used instead of `.rejects.toThrow()` for errors raised by SQLite: better-sqlite3 errors can be created
 * in a different Jest realm when workers are busy, and `toThrow` then reports "did not throw" for a promise
 * that did reject.
 */
export async function rejectionMessage(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error: unknown) {
    const message = (error as { message?: unknown } | null)?.message;
    return typeof message === 'string' ? message : String(error);
  }
}
