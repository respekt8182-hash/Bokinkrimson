import { describe, expect, it } from "vitest";
import { resolveLocationDirectoryItemFromTexts } from "@/lib/location-directory";

const locations = [
  { id: "feodosiya", name: "Феодосия" },
  { id: "koktebel", name: "Коктебель" },
  { id: "sudak", name: "Судак" },
];

describe("location directory text resolver", () => {
  it("prefers the precise settlement over the administrative city", () => {
    const match = resolveLocationDirectoryItemFromTexts(locations, [
      "Феодосия",
      "Республика Крым, городской округ Феодосия, пгт Коктебель, улица Юнге, 1",
    ]);

    expect(match?.id).toBe("koktebel");
  });

  it("still resolves a plain city when no more precise settlement is present", () => {
    const match = resolveLocationDirectoryItemFromTexts(locations, [
      "Республика Крым, Феодосия, проспект Айвазовского, 7",
    ]);

    expect(match?.id).toBe("feodosiya");
  });
});
