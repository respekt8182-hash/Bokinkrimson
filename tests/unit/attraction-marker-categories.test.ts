import { describe, expect, it } from "vitest";
import { getSpecialAttractionMarkerCategory } from "@/lib/attraction-marker-categories";

describe("special attraction map markers", () => {
  it.each([
    ["Тихая бухта", "bay"],
    ["Керченский пролив", "strait"],
    ["Феодосийский залив", "gulf"],
    ["Крымский мост", "crimean_bridge"],
    ["Ялтинский дельфинарий", "dolphinarium"],
  ] as const)("uses a dedicated marker for %s", (title, expected) => {
    expect(getSpecialAttractionMarkerCategory({ title })).toBe(expected);
  });

  it("supports transliterated public paths", () => {
    expect(getSpecialAttractionMarkerCategory({ path: "/attractions/tihaya-bukhta" })).toBe("bay");
    expect(getSpecialAttractionMarkerCategory({ path: "/attractions/krymskiy-most" })).toBe(
      "crimean_bridge",
    );
  });

  it("does not use descriptions or nearby-place tags", () => {
    expect(
      getSpecialAttractionMarkerCategory({
        title: "Гора Митридат",
        path: "/attractions/gora-mitridat",
      }),
    ).toBeNull();
  });
});
