import { describe, expect, it } from "vitest";
import { resolveAdminRelationUserId } from "../../src/lib/admin-user-reference";

describe("resolveAdminRelationUserId", () => {
  it("returns null for standalone admin ids", () => {
    expect(resolveAdminRelationUserId("admin:admin")).toBeNull();
    expect(resolveAdminRelationUserId(" admin:manager ")).toBeNull();
  });

  it("returns null for blank values", () => {
    expect(resolveAdminRelationUserId("")).toBeNull();
    expect(resolveAdminRelationUserId("   ")).toBeNull();
  });

  it("keeps database-backed user ids unchanged", () => {
    expect(resolveAdminRelationUserId("cmnvlmgxu000hexb49bd3u6tx")).toBe(
      "cmnvlmgxu000hexb49bd3u6tx",
    );
  });
});
