import { afterEach, describe, expect, it } from "vitest";
import {
  buildCatalogMapViewportScope,
  readCatalogMapViewport,
  writeCatalogMapViewport,
} from "@/lib/catalog-map-memory";

class MemoryStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function installStorageWindow() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("catalog map memory", () => {
  it("builds a stable viewport scope without volatile map params", () => {
    expect(
      buildCatalogMapViewportScope("/attractions", "category=parks&bounds=1,2,3,4&page=3"),
    ).toBe("/attractions?category=parks");
  });

  it("persists bounds, center and zoom for back/forward map restore", () => {
    installStorageWindow();

    writeCatalogMapViewport("attractions", "/attractions?category=parks", {
      bounds: [
        [44.1, 33.1],
        [45.1, 34.1],
      ],
      center: [44.6, 33.6],
      zoom: 11.5,
    });

    expect(readCatalogMapViewport("attractions", "/attractions?category=parks")).toEqual({
      bounds: [
        [44.1, 33.1],
        [45.1, 34.1],
      ],
      center: [44.6, 33.6],
      zoom: 11.5,
    });
  });
});
