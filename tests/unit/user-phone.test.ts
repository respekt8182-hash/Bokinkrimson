import { describe, expect, it } from "vitest";

import {
  buildUserPhoneLookupCandidates,
  normalizeUserPhone,
} from "../../src/lib/user-phone";

describe("user phone normalization", () => {
  it("normalizes local russian numbers to a canonical digit-only value", () => {
    expect(normalizeUserPhone("+7 (999) 000-00-01")).toBe("79990000001");
    expect(normalizeUserPhone("9990000001")).toBe("79990000001");
  });

  it("builds lookup candidates for legacy and canonical stored values", () => {
    expect(buildUserPhoneLookupCandidates("+7 (999) 000-00-01")).toEqual([
      "79990000001",
      "+79990000001",
      "89990000001",
      "+7 (999) 000-00-01",
    ]);
  });
});
