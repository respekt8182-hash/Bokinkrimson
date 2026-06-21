import { describe, expect, it } from "vitest";
import { getCatalogPageFromSearch } from "@/lib/catalog-pagination";

describe("getCatalogPageFromSearch", () => {
  it("restores a catalog page from the URL", () => {
    expect(getCatalogPageFromSearch("?direction=housing&page=5")).toBe(5);
  });

  it.each(["", "?page=", "?page=invalid", "?page=0", "?page=-2"])(
    "falls back to the first page for %s",
    (search) => {
      expect(getCatalogPageFromSearch(search)).toBe(1);
    },
  );
});
