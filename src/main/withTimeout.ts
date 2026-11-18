/** Waits for `promise` at most `ms`; a rejection counts as settled, so the caller can always go on. */
export async function withTimeout(promise: Promise<unknown>, ms: number): Promise<'done' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  try {
    return await Promise.race([promise.then(() => 'done' as const, () => 'done' as const), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
