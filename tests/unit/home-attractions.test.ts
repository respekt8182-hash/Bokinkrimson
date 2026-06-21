import { describe, expect, it } from "vitest";
import { isHomeAttractionCandidate } from "@/lib/home-attractions";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    title: "Воронцовский дворец",
    category: "Дворцы и архитектура",
    tags: [],
    searchKeywords: [],
    gallery: [{ url: "/attractions/palace.webp", alt: "" }],
    isPublishedVisible: true,
    ...overrides,
  };
}

describe("home attraction selection", () => {
  it("allows a published non-beach attraction with a real photo", () => {
    expect(isHomeAttractionCandidate(candidate())).toBe(true);
  });

  it.each([
    { category: "Пляжи и купание" },
    { title: "Центральный пляж Ялты" },
    { tags: ["галечный пляж"] },
    { searchKeywords: ["пляж у моря"] },
  ])("rejects beach content: %o", (overrides) => {
    expect(isHomeAttractionCandidate(candidate(overrides))).toBe(false);
  });
});
