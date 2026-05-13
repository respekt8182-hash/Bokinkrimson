import { describe, expect, it } from "vitest";
import { normalizeEmailAddress, normalizeEmailHref, normalizeWhatsappUrl } from "@/lib/contact-links";

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

describe("normalizeEmailHref", () => {
  it("normalizes valid email addresses to mailto links", () => {
    expect(normalizeEmailAddress(" OWNER@Example.COM ")).toBe("owner@example.com");
    expect(normalizeEmailHref(" OWNER@Example.COM ")).toBe("mailto:owner@example.com");
  });

  it("ignores invalid email values", () => {
    expect(normalizeEmailHref("not an email")).toBeNull();
    expect(normalizeEmailHref("owner@example")).toBeNull();
    expect(normalizeEmailHref("owner@example.com?subject=test")).toBeNull();
    expect(normalizeEmailHref("mailto:owner@example.com")).toBeNull();
  });
});
