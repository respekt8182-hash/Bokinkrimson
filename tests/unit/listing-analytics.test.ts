import { describe, expect, it } from "vitest";
import {
  buildListingActionCounterGroup,
  normalizeListingActionType,
} from "@/lib/listing-analytics";

describe("listing analytics action taxonomy", () => {
  it("groups booking and lead-form actions separately from phones and messengers", () => {
    const counters = buildListingActionCounterGroup(
      new Map([
        ["phone_primary", 2],
        ["phone_secondary", 1],
        ["whatsapp", 3],
        ["lead_phrase", 4],
        ["lead_form", 5],
        ["booking", 6],
        ["website", 7],
      ]),
    );

    expect(counters).toEqual({
      phones: 3,
      messengers: 3,
      leads: 9,
      website: 7,
      booking: 6,
      other: 0,
    });
    expect(normalizeListingActionType("booking")).toBe("booking");
    expect(normalizeListingActionType("lead_form")).toBe("lead_form");
  });
});
