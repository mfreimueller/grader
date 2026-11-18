import { withTimeout } from '../../../src/main/withTimeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with "done" when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('x'), 1000)).resolves.toBe('done');
  });

  it('resolves with "timeout" when the promise hangs', async () => {
    const result = withTimeout(new Promise<void>(() => undefined), 1000);
    jest.advanceTimersByTime(1000);

    await expect(result).resolves.toBe('timeout');
  });

  it('resolves with "done" when the promise rejects, so quitting goes on', async () => {
    await expect(withTimeout(Promise.reject(new Error('x')), 1000)).resolves.toBe('done');
  });

  it('clears its timer when the promise settles', async () => {
    await withTimeout(Promise.resolve(), 1000);

    expect(jest.getTimerCount()).toBe(0);
  });
});
