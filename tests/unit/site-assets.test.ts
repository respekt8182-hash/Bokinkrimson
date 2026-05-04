import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

describe("site public assets", () => {
  it("keeps the yandex webmaster verification file in the public root", () => {
    const verificationFile = join(process.cwd(), "public", "yandex_162a9e404c5f12fc.html");

    expect(existsSync(verificationFile)).toBe(true);
    expect(readFileSync(verificationFile, "utf8")).toContain("Verification: 162a9e404c5f12fc");
  });

  it("keeps the root favicon assets available for crawlers", async () => {
    const faviconSvg = join(process.cwd(), "public", "favicon.svg");
    const faviconIco = join(process.cwd(), "public", "favicon.ico");
    const favicon32Png = join(process.cwd(), "public", "favicon-32x32.png");
    const favicon120Png = join(process.cwd(), "public", "favicon-120x120.png");
    const appleTouchIcon = join(process.cwd(), "public", "apple-touch-icon.png");
    const socialPreview = join(process.cwd(), "public", "social-preview.png");

    expect(existsSync(faviconSvg)).toBe(true);
    expect(existsSync(faviconIco)).toBe(true);
    expect(existsSync(favicon32Png)).toBe(true);
    expect(existsSync(favicon120Png)).toBe(true);
    expect(existsSync(appleTouchIcon)).toBe(true);
    expect(existsSync(socialPreview)).toBe(true);

    const svg = readFileSync(faviconSvg, "utf8");
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('viewBox="220 220 3010 3010"');
    expect(svg).not.toMatch(/<(script|animate|foreignObject)\b/i);

    const ico = readFileSync(faviconIco);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);

    const iconCount = ico.readUInt16LE(4);
    const sizes = Array.from({ length: iconCount }, (_, index) => {
      const offset = 6 + index * 16;
      const imageOffset = ico.readUInt32LE(offset + 12);

      expect(ico.subarray(imageOffset, imageOffset + 8).toString("hex")).toBe("89504e470d0a1a0a");

      return {
        width: ico[offset] || 256,
        height: ico[offset + 1] || 256,
      };
    });

    expect(sizes).toEqual([
      { width: 16, height: 16 },
      { width: 32, height: 32 },
      { width: 120, height: 120 },
    ]);

    await expect(sharp(favicon32Png).metadata()).resolves.toMatchObject({
      format: "png",
      width: 32,
      height: 32,
    });
    await expect(sharp(favicon120Png).metadata()).resolves.toMatchObject({
      format: "png",
      width: 120,
      height: 120,
    });
    await expect(sharp(appleTouchIcon).metadata()).resolves.toMatchObject({
      format: "png",
      width: 180,
      height: 180,
    });
    await expect(sharp(socialPreview).metadata()).resolves.toMatchObject({
      format: "png",
      width: 1200,
      height: 630,
    });
  });
});
