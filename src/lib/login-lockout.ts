type LockoutBucket = {
  failedAttempts: number;
  firstFailedAt: number;
  lockedUntil: number | null;
};

type LockoutStore = Map<string, LockoutBucket>;

type FailedLoginLockoutOptions = {
  id: string;
  maxFailedAttempts: number;
  lockoutMs: number;
  now?: () => number;
};

export type FailedLoginLockoutState = {
  locked: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
  resetAt: number | null;
};

declare global {
  var __bokingFailedLoginLockoutStores: Map<string, LockoutStore> | undefined;
}

function getStore(id: string): LockoutStore {
  if (!global.__bokingFailedLoginLockoutStores) {
    global.__bokingFailedLoginLockoutStores = new Map<string, LockoutStore>();
  }

  const existing = global.__bokingFailedLoginLockoutStores.get(id);
  if (existing) {
    return existing;
  }

  const created: LockoutStore = new Map();
  global.__bokingFailedLoginLockoutStores.set(id, created);
  return created;
}

function retryAfterSeconds(until: number, now: number): number {
  return Math.max(1, Math.ceil((until - now) / 1000));
}

export function createFailedLoginLockout(options: FailedLoginLockoutOptions) {
  const store = getStore(options.id);
  const getNow = options.now ?? (() => Date.now());

  function clearExpired(key: string, now: number): LockoutBucket | null {
    const entry = store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      return entry;
    }

    if (entry.lockedUntil || entry.firstFailedAt + options.lockoutMs <= now) {
      store.delete(key);
      return null;
    }

    return entry;
  }

  function unlockedState(entry: LockoutBucket | null): FailedLoginLockoutState {
    return {
      locked: false,
      retryAfterSeconds: 0,
      remainingAttempts: Math.max(0, options.maxFailedAttempts - (entry?.failedAttempts ?? 0)),
      resetAt: entry ? entry.firstFailedAt + options.lockoutMs : null,
    };
  }

  return {
    check(key: string): FailedLoginLockoutState {
      const now = getNow();
      const entry = clearExpired(key, now);

      if (entry?.lockedUntil && entry.lockedUntil > now) {
        return {
          locked: true,
          retryAfterSeconds: retryAfterSeconds(entry.lockedUntil, now),
          remainingAttempts: 0,
          resetAt: entry.lockedUntil,
        };
      }

      return unlockedState(entry);
    },

    recordFailure(key: string): FailedLoginLockoutState {
      const now = getNow();
      const existing = clearExpired(key, now);

      if (existing?.lockedUntil && existing.lockedUntil > now) {
        return {
          locked: true,
          retryAfterSeconds: retryAfterSeconds(existing.lockedUntil, now),
          remainingAttempts: 0,
          resetAt: existing.lockedUntil,
        };
      }

      const entry = existing ?? {
        failedAttempts: 0,
        firstFailedAt: now,
        lockedUntil: null,
      };

      entry.failedAttempts += 1;

      if (entry.failedAttempts >= options.maxFailedAttempts) {
        entry.failedAttempts = options.maxFailedAttempts;
        entry.lockedUntil = now + options.lockoutMs;
        store.set(key, entry);

        return {
          locked: true,
          retryAfterSeconds: retryAfterSeconds(entry.lockedUntil, now),
          remainingAttempts: 0,
          resetAt: entry.lockedUntil,
        };
      }

      store.set(key, entry);
      return unlockedState(entry);
    },

    reset(key: string): void {
      store.delete(key);
    },
  };
}

export function clearFailedLoginLockoutStoresForTest(): void {
  global.__bokingFailedLoginLockoutStores?.clear();
}
