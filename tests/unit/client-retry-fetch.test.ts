import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "@/lib/client-retry-fetch";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithRetry", () => {
  it("retries transient server errors", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = fetchWithRetry("/api/map/accommodations", {
      retries: 1,
      retryDelayMs: 25,
      timeoutMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(25);
    const response = await responsePromise;

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
