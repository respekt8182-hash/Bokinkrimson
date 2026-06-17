import { describe, expect, it } from "vitest";
import {
  buildRedactedPublicContactFields,
  hasRevealableContact,
  maskPublicPhone,
} from "../../src/lib/public-contact-redaction";

describe("public contact redaction", () => {
  it("masks phone numbers without keeping the full value", () => {
    expect(maskPublicPhone("+7 999 111-22-33")).toBe("+7 *** ** **");
    expect(maskPublicPhone("+371 22 123 456")).toBe("+371 *** ** **");
    expect(maskPublicPhone("")).toBeNull();
  });

  it("keeps only availability flags for hidden direct contacts", () => {
    const redacted = buildRedactedPublicContactFields({
      phone: "+7 999 111-22-33",
      email: "owner@example.test",
      whatsappUrl: "https://wa.me/79991112233",
    });

    expect(redacted).toEqual({
      phoneMasked: "+7 *** ** **",
      phoneAvailable: true,
      emailAvailable: true,
      messengerAvailable: true,
    });
    expect(hasRevealableContact(redacted)).toBe(true);
    expect(JSON.stringify(redacted)).not.toContain("999");
    expect(JSON.stringify(redacted)).not.toContain("owner@example.test");
  });
});
