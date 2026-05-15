import { describe, expect, it } from "vitest";
import {
  normalizeExternalReviewSourceName,
  parseExternalReviewImportPayload,
  repairMojibake,
} from "../../src/lib/external-review-import";

function mojibake(value: string): string {
  return new TextDecoder("windows-1251").decode(new TextEncoder().encode(value));
}

describe("external review import", () => {
  it("repairs UTF-8 text that was decoded as Windows-1251", () => {
    expect(
      repairMojibake(mojibake("\u041a\u0443\u0434\u0430 \u043d\u0430 \u043c\u043e\u0440\u0435")),
    ).toBe("\u041a\u0443\u0434\u0430 \u043d\u0430 \u043c\u043e\u0440\u0435");
  });

  it("parses the scraper JSON shape into imported reviews", () => {
    const result = parseExternalReviewImportPayload({
      results: [
        {
          source: mojibake("\u041a\u0443\u0434\u0430 \u043d\u0430 \u043c\u043e\u0440\u0435"),
          url: "https://www.kudanamore.ru/evpatoriya/hotels/31850/",
          reviews: [
            {
              author: mojibake("\u041b\u0435\u0439\u0441\u0430\u043d"),
              city: mojibake("\u0418\u0436\u0435\u0432\u0441\u043a"),
              text: mojibake(
                "\u0412\u0441\u0435 \u043e\u0447\u0435\u043d\u044c \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u043e\u0441\u044c, \u0447\u0438\u0441\u0442\u043e \u0438 \u0443\u044e\u0442\u043d\u043e.",
              ),
              rating: 5,
              date: mojibake("\u0430\u0432\u0433\u0443\u0441\u0442 2025"),
              review_id: "https://www.kudanamore.ru/evpatoriya/hotels/31850/#review-1",
            },
          ],
        },
      ],
    });

    expect(result.skipped).toHaveLength(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      authorName: "\u041b\u0435\u0439\u0441\u0430\u043d",
      guestCity: "\u0418\u0436\u0435\u0432\u0441\u043a",
      rating: 5,
      reviewedAt: "2025-08-01",
      sourceName: "\u041a\u0443\u0434\u0430 \u043d\u0430 \u043c\u043e\u0440\u0435",
      sourceUrl: "https://www.kudanamore.ru/evpatoriya/hotels/31850/#review-1",
    });
  });

  it("normalizes known source names from hostnames", () => {
    expect(normalizeExternalReviewSourceName(null, "https://travel.yandex.ru/hotels/demo/")).toBe(
      "\u042f\u043d\u0434\u0435\u043a\u0441 \u041f\u0443\u0442\u0435\u0448\u0435\u0441\u0442\u0432\u0438\u044f",
    );
    expect(normalizeExternalReviewSourceName("TVIL", "https://tvil.ru/demo")).toBe(
      "\u0422\u0412\u0418\u041b",
    );
  });
});
