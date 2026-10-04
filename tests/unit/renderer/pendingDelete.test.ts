import { PendingDeletes, UNDO_DELAY_MS } from '../../../src/renderer/utils/pendingDelete';

interface Item {
  title: string;
}

const deferred = (): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('PendingDeletes', () => {
  let commit: jest.Mock<Promise<void>, [Item]>;
  let onChange: jest.Mock<void, [readonly string[]]>;
  let onError: jest.Mock<void, [Item, unknown]>;
  let pending: PendingDeletes<Item>;

  beforeEach(() => {
    jest.useFakeTimers();
    commit = jest.fn<Promise<void>, [Item]>(async () => {});
    onChange = jest.fn<void, [readonly string[]]>();
    onError = jest.fn<void, [Item, unknown]>();
    pending = new PendingDeletes<Item>({ commit, onChange, onError });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits 6 seconds by default', () => {
    expect(UNDO_DELAY_MS).toBe(6000);
  });

  describe('schedule', () => {
    it('marks the item as pending without committing yet', async () => {
      pending.schedule('a', { title: 'A' });

      expect(pending.has('a')).toBe(true);
      expect(pending.ids()).toEqual(['a']);
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS - 1);
      expect(commit).not.toHaveBeenCalled();
    });

    it('commits the item once the delay has passed and then forgets it', async () => {
      pending.schedule('a', { title: 'A' });

      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith({ title: 'A' });
      expect(pending.has('a')).toBe(false);
      expect(pending.ids()).toEqual([]);
    });

    it('reports every change of the pending ids', async () => {
      pending.schedule('a', { title: 'A' });
      expect(onChange).toHaveBeenLastCalledWith(['a']);
      pending.schedule('b', { title: 'B' });
      expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);

      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('ignores a second schedule for the same id', async () => {
      pending.schedule('a', { title: 'first' });
      pending.schedule('a', { title: 'second' });

      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith({ title: 'first' });
    });

    it('gives every item its own timer', async () => {
      pending.schedule('a', { title: 'A' });
      await jest.advanceTimersByTimeAsync(3000);
      pending.schedule('b', { title: 'B' });

      await jest.advanceTimersByTimeAsync(3000);
      expect(commit.mock.calls.map(([i]) => i.title)).toEqual(['A']);

      await jest.advanceTimersByTimeAsync(3000);
      expect(commit.mock.calls.map(([i]) => i.title)).toEqual(['A', 'B']);
    });

    it('uses a custom delay', async () => {
      const quick = new PendingDeletes<Item>({ commit, delayMs: 100 });
      quick.schedule('a', { title: 'A' });

      await jest.advanceTimersByTimeAsync(100);

      expect(commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('undo', () => {
    it('cancels the delete and hands the item back', async () => {
      pending.schedule('a', { title: 'A' });

      const item = pending.undo('a');

      expect(item).toEqual({ title: 'A' });
      expect(pending.has('a')).toBe(false);
      expect(onChange).toHaveBeenLastCalledWith([]);
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS * 2);
      expect(commit).not.toHaveBeenCalled();
    });

    it('does not touch the other pending items', async () => {
      pending.schedule('a', { title: 'A' });
      pending.schedule('b', { title: 'B' });

      pending.undo('a');
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(commit.mock.calls.map(([i]) => i.title)).toEqual(['B']);
    });

    it('returns null for an unknown id', () => {
      expect(pending.undo('missing')).toBeNull();
    });

    it('returns null once the delete was committed', async () => {
      pending.schedule('a', { title: 'A' });
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(pending.undo('a')).toBeNull();
    });

    it('returns null while the commit is running, because it is too late', async () => {
      const running = deferred();
      commit.mockReturnValueOnce(running.promise);
      pending.schedule('a', { title: 'A' });
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(pending.has('a')).toBe(true);
      expect(pending.undo('a')).toBeNull();

      running.resolve();
      await jest.advanceTimersByTimeAsync(0);
      expect(pending.has('a')).toBe(false);
    });
  });

  describe('flush', () => {
    it('commits everything pending right away and stops the timers', async () => {
      pending.schedule('a', { title: 'A' });
      pending.schedule('b', { title: 'B' });

      await pending.flush();

      expect(commit.mock.calls.map(([i]) => i.title)).toEqual(['A', 'B']);
      expect(pending.ids()).toEqual([]);
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS * 2);
      expect(commit).toHaveBeenCalledTimes(2);
    });

    it('resolves immediately when nothing is pending', async () => {
      await expect(pending.flush()).resolves.toBeUndefined();
      expect(commit).not.toHaveBeenCalled();
    });

    it('waits for a commit that is already running', async () => {
      const running = deferred();
      commit.mockReturnValueOnce(running.promise);
      pending.schedule('a', { title: 'A' });
      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      let flushed = false;
      const flushing = pending.flush().then(() => {
        flushed = true;
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(flushed).toBe(false);

      running.resolve();
      await flushing;
      expect(flushed).toBe(true);
      expect(commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('failures', () => {
    it('reports a failed commit, forgets the item and keeps going', async () => {
      const boom = new Error('disk full');
      commit.mockRejectedValueOnce(boom);
      pending.schedule('a', { title: 'A' });
      pending.schedule('b', { title: 'B' });

      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({ title: 'A' }, boom);
      expect(commit).toHaveBeenCalledTimes(2);
      expect(pending.ids()).toEqual([]);
    });

    it('still commits the others on flush when one fails', async () => {
      commit.mockRejectedValueOnce(new Error('nope'));
      pending.schedule('a', { title: 'A' });
      pending.schedule('b', { title: 'B' });

      await pending.flush();

      expect(commit).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(pending.ids()).toEqual([]);
    });

    it('works without callbacks', async () => {
      commit.mockRejectedValueOnce(new Error('nope'));
      const bare = new PendingDeletes<Item>({ commit });
      bare.schedule('a', { title: 'A' });

      await jest.advanceTimersByTimeAsync(UNDO_DELAY_MS);

      expect(bare.ids()).toEqual([]);
    });
  });
});
