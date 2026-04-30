import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WindowMock = {
  localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
};

function createWindowMock(): WindowMock {
  const storage = new Map<string, string>();
  const listeners = new Map<string, Set<EventListener>>();

  return {
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? new Set<EventListener>();
      group.add(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };
}

describe("local favorites", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: createWindowMock(),
    });
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as typeof globalThis & { window?: Window }).window;
      return;
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("migrates legacy string arrays into typed property favorites", async () => {
    window.localStorage.setItem("wishlisted_ids", JSON.stringify(["property-1", "property-2"]));

    const favoritesModule = await import("../../src/lib/local-favorites");

    expect(favoritesModule.getLocalFavorites()).toEqual([
      { entityType: "property", id: "property-1" },
      { entityType: "property", id: "property-2" },
    ]);
    expect(window.localStorage.getItem("wishlisted_ids")).toBe(
      JSON.stringify([
        { entityType: "property", id: "property-1" },
        { entityType: "property", id: "property-2" },
      ]),
    );
  });

  it("keeps excursion, tour, attraction, and transfer favorites separate even with the same id", async () => {
    const favoritesModule = await import("../../src/lib/local-favorites");

    favoritesModule.toggleLocalFavorite({ entityType: "excursion", id: "shared-id" });
    favoritesModule.toggleLocalFavorite({ entityType: "tour", id: "shared-id" });
    favoritesModule.toggleLocalFavorite({ entityType: "attraction", id: "shared-id" });
    favoritesModule.toggleLocalFavorite({ entityType: "transfer", id: "shared-id" });

    expect(favoritesModule.getLocalFavorites()).toEqual([
      { entityType: "excursion", id: "shared-id" },
      { entityType: "tour", id: "shared-id" },
      { entityType: "attraction", id: "shared-id" },
      { entityType: "transfer", id: "shared-id" },
    ]);
    expect(favoritesModule.isLocalFavorite({ entityType: "excursion", id: "shared-id" })).toBe(
      true,
    );
    expect(favoritesModule.isLocalFavorite({ entityType: "tour", id: "shared-id" })).toBe(true);
    expect(favoritesModule.isLocalFavorite({ entityType: "attraction", id: "shared-id" })).toBe(
      true,
    );
    expect(favoritesModule.isLocalFavorite({ entityType: "transfer", id: "shared-id" })).toBe(true);
  });

  it("notifies subscribers when favorites change", async () => {
    const favoritesModule = await import("../../src/lib/local-favorites");
    const onChange = vi.fn();

    const unsubscribe = favoritesModule.subscribeLocalFavoritesChange(onChange);
    favoritesModule.setLocalFavorite({ entityType: "tour", id: "tour-1" }, true);
    unsubscribe();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
