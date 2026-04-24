import { describe, expect, it } from "vitest";
import {
  getPrimaryExcursionSearchScore,
  normalizeExcursionSearchText,
} from "../../src/lib/public-excursions";

describe("public excursion search helpers", () => {
  it("normalizes excursion search text consistently", () => {
    expect(normalizeExcursionSearchText("  Севастополь, Ёж  ")).toBe("севастополь еж");
  });

  it("matches excursion title directly", () => {
    const score = getPrimaryExcursionSearchScore("Ай-Петри", [
      "Большое путешествие на Ай-Петри",
      "Ялта",
    ]);

    expect(score).toBeGreaterThan(0);
  });

  it("matches excursion location directly", () => {
    const score = getPrimaryExcursionSearchScore("Севастополь", [
      "Морская прогулка",
      "Балаклава",
      "Севастополь",
    ]);

    expect(score).toBeGreaterThan(0);
  });

  it("matches split query across title and location", () => {
    const score = getPrimaryExcursionSearchScore("морская севастополь", [
      "Морская прогулка вдоль бухт",
      "Севастополь",
    ]);

    expect(score).toBeGreaterThan(0);
  });
});
