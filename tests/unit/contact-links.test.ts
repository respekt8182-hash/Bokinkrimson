import { describe, expect, it } from "vitest";
import { normalizeWhatsappUrl } from "@/lib/contact-links";

describe("normalizeWhatsappUrl", () => {
  it("keeps existing http links", () => {
    expect(normalizeWhatsappUrl("https://wa.me/79991234567")).toBe("https://wa.me/79991234567");
  });

  it("builds a wa.me link from a Russian phone number", () => {
    expect(normalizeWhatsappUrl("+7 (999) 123-45-67")).toBe("https://wa.me/79991234567");
    expect(normalizeWhatsappUrl("8 999 123 45 67")).toBe("https://wa.me/79991234567");
  });

  it("ignores invalid plain text", () => {
    expect(normalizeWhatsappUrl("not a phone")).toBeNull();
  });
});
