type RetryableFetchInit = RequestInit & {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

const defaultRetries = 2;
const defaultRetryDelayMs = 350;
const defaultTimeoutMs = 8_000;

function createAbortError(): Error {
  const error = new Error("fetch_aborted");
  error.name = "AbortError";
  return error;
}

function isAbortSignalAborted(signal: AbortSignal | null | undefined): boolean {
  return signal?.aborted === true;
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelay(baseDelayMs: number, attempt: number): number {
  return baseDelayMs * 2 ** Math.max(0, attempt - 1);
}

function waitForRetry(delayMs: number, signal: AbortSignal | null | undefined): Promise<void> {
  if (isAbortSignalAborted(signal)) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let handleAbort: (() => void) | null = null;
    const timer = globalThis.setTimeout(() => {
      if (handleAbort) {
        signal?.removeEventListener("abort", handleAbort);
      }
      resolve();
    }, delayMs);

    handleAbort = () => {
      globalThis.clearTimeout(timer);
      if (handleAbort) {
        signal?.removeEventListener("abort", handleAbort);
      }
      reject(createAbortError());
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RetryableFetchInit = {},
): Promise<Response> {
  const {
    retries = defaultRetries,
    retryDelayMs = defaultRetryDelayMs,
    timeoutMs = defaultTimeoutMs,
    signal,
    ...fetchInit
  } = init;
  const maxAttempts = Math.max(1, retries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (isAbortSignalAborted(signal)) {
      throw createAbortError();
    }

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    const handleAbort = () => controller.abort();
    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      const response = await fetch(input, {
        ...fetchInit,
        signal: controller.signal,
      });

      if (response.ok || !shouldRetryStatus(response.status) || attempt === maxAttempts) {
        return response;
      }
    } catch (error) {
      if (isAbortSignalAborted(signal) || attempt === maxAttempts) {
        throw error;
      }
    } finally {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
    }

    await waitForRetry(getRetryDelay(retryDelayMs, attempt), signal);
  }

  throw new Error("fetch_retry_exhausted");
}
