// Shared pacing helpers: cancellable sleep and exponential backoff with jitter.

export const INTER_TASK_DELAY_MS = 2000;

const RETRY = { maxAttempts: 6, baseDelayMs: 2000, maxDelayMs: 60000 };

export class AbortedError extends Error {
  constructor() {
    super('Generation cancelled');
    this.name = 'AbortedError';
  }
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new AbortedError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Calls fn with exponential backoff + jitter while isRetryable(err) is true.
 * retryAfterMs(err) may return a server-requested wait, which is honoured.
 * onRetry({ attempt, delayMs, error }) is called before each wait.
 */
export async function withBackoff(fn, { signal, onRetry, isRetryable = () => false, retryAfterMs = () => null } = {}) {
  let attempt = 0;
  for (;;) {
    if (signal?.aborted) throw new AbortedError();
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted) throw new AbortedError();
      attempt += 1;
      if (!isRetryable(err) || attempt >= RETRY.maxAttempts) throw err;
      const exp = Math.min(RETRY.maxDelayMs, RETRY.baseDelayMs * 2 ** (attempt - 1));
      const jittered = exp / 2 + Math.random() * (exp / 2);
      const delayMs = Math.min(RETRY.maxDelayMs * 2, Math.max(jittered, retryAfterMs(err) ?? 0));
      onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs, signal);
    }
  }
}
