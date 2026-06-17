import { describe, expect, it } from "vitest";
import {
  isContactClientMarkedSuspicious,
  markContactHoneypotHit,
  resetContactRevealStateForTests,
} from "../../src/lib/listing-contact-reveal";

describe("listing contact honeypot", () => {
  it("marks the requesting client as suspicious without exposing contacts", () => {
    resetContactRevealStateForTests();
    const request = new Request("http://localhost:3000/api/listing-contacts/canary", {
      headers: {
        "user-agent": "test-bot",
        "x-forwarded-for": "203.0.113.10",
      },
    });

    expect(isContactClientMarkedSuspicious(request, "visitor-1")).toBe(false);

    const clientKey = markContactHoneypotHit(request, "visitor-1");

    expect(clientKey).toHaveLength(32);
    expect(isContactClientMarkedSuspicious(request, "visitor-1")).toBe(true);
  });
});
