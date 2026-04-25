import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("site public assets", () => {
  it("keeps the yandex webmaster verification file in the public root", () => {
    const verificationFile = join(process.cwd(), "public", "yandex_162a9e404c5f12fc.html");

    expect(existsSync(verificationFile)).toBe(true);
    expect(readFileSync(verificationFile, "utf8")).toContain("Verification: 162a9e404c5f12fc");
  });

  it("keeps the root favicon assets available for crawlers", () => {
    expect(existsSync(join(process.cwd(), "public", "favicon.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public", "apple-touch-icon.png"))).toBe(true);
  });
});
