import { describe, expect, it } from "vitest";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

describe("normalizeTelegramProfileUrl", () => {
  it("keeps existing username inputs", () => {
    expect(normalizeTelegramProfileUrl("@booking_crimea")).toBe("https://t.me/booking_crimea");
    expect(normalizeTelegramProfileUrl("https://t.me/booking_crimea")).toBe(
      "https://t.me/booking_crimea",
    );
  });

  it("builds a Telegram phone link from a Russian phone number", () => {
    expect(normalizeTelegramProfileUrl("+7 (999) 123-45-67")).toBe(
      "https://t.me/+79991234567",
    );
    expect(normalizeTelegramProfileUrl("8 999 123 45 67")).toBe("https://t.me/+79991234567");
    expect(normalizeTelegramProfileUrl("9991234567")).toBe("https://t.me/+79991234567");
  });

  it("normalizes Telegram phone deep links", () => {
    expect(normalizeTelegramProfileUrl("https://t.me/+7 999 123 45 67")).toBe(
      "https://t.me/+79991234567",
    );
    expect(normalizeTelegramProfileUrl("tg://resolve?phone=79991234567")).toBe(
      "https://t.me/+79991234567",
    );
  });

  it("ignores invalid Telegram text", () => {
    expect(normalizeTelegramProfileUrl("not a telegram contact")).toBeNull();
  });
});
