import { describe, expect, it } from "vitest";
import { getDailyDateKey, selectDailyItems } from "@/lib/daily-selection";

const items = Array.from({ length: 30 }, (_, index) => ({ id: `item-${index}` }));

describe("daily selection", () => {
  it("keeps the same selection throughout a Moscow calendar day", () => {
    const morning = getDailyDateKey(new Date("2026-06-21T01:00:00Z"));
    const evening = getDailyDateKey(new Date("2026-06-21T19:00:00Z"));

    expect(morning).toBe(evening);
    expect(
      selectDailyItems(items, {
        dateKey: morning,
        selectionKey: "test",
        limit: 8,
        getId: (item) => item.id,
      }),
    ).toEqual(
      selectDailyItems(items, {
        dateKey: evening,
        selectionKey: "test",
        limit: 8,
        getId: (item) => item.id,
      }),
    );
  });

  it("rotates the selection on the next Moscow day", () => {
    const first = selectDailyItems(items, {
      dateKey: "2026-06-21",
      selectionKey: "test",
      limit: 8,
      getId: (item) => item.id,
    });
    const next = selectDailyItems(items, {
      dateKey: "2026-06-22",
      selectionKey: "test",
      limit: 8,
      getId: (item) => item.id,
    });

    expect(next).not.toEqual(first);
  });
});
