// Deferred delete with undo. Assessments are deleted for good, so "undo" means: hide the item at once, delete
// it after a delay, and cancel that delete when the user clicks "Rückgängig". Leaving the grid flushes
// everything that is still waiting, so a delete is never silently lost.

export const UNDO_DELAY_MS = 6000;

export interface PendingDeleteOptions<T> {
  /** Performs the real delete. */
  commit: (item: T) => Promise<void>;
  /** Called with the ids that are currently hidden but not yet deleted. */
  onChange?: (pendingIds: readonly string[]) => void;
  /** Called when a commit failed; the item is forgotten, so the next reload shows it again. */
  onError?: (item: T, error: unknown) => void;
  delayMs?: number;
}

interface Entry<T> {
  item: T;
  timer: ReturnType<typeof setTimeout>;
  committing: Promise<void> | null;
}

export class PendingDeletes<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly options: PendingDeleteOptions<T>) {}

  has(id: string): boolean {
    return this.entries.has(id);
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }

  schedule(id: string, item: T): void {
    if (this.entries.has(id)) return;
    const entry: Entry<T> = {
      item,
      timer: setTimeout(() => void this.commit(id, entry), this.options.delayMs ?? UNDO_DELAY_MS),
      committing: null,
    };
    this.entries.set(id, entry);
    this.notify();
  }

  /** Cancels a waiting delete and returns the item; null when it is unknown or already being deleted. */
  undo(id: string): T | null {
    const entry = this.entries.get(id);
    if (!entry || entry.committing) return null;
    clearTimeout(entry.timer);
    this.entries.delete(id);
    this.notify();
    return entry.item;
  }

  /** Deletes everything that is still waiting right now and waits for deletes that are already running. */
  async flush(): Promise<void> {
    await Promise.all([...this.entries].map(([id, entry]) => this.commit(id, entry)));
  }

  private commit(id: string, entry: Entry<T>): Promise<void> {
    if (entry.committing) return entry.committing;
    clearTimeout(entry.timer);
    entry.committing = (async () => {
      try {
        await this.options.commit(entry.item);
      } catch (error: unknown) {
        this.options.onError?.(entry.item, error);
      } finally {
        this.entries.delete(id);
        this.notify();
      }
    })();
    return entry.committing;
  }

  private notify(): void {
    this.options.onChange?.(this.ids());
  }
}
