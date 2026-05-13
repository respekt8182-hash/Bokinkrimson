import { afterEach, describe, expect, it } from "vitest";
import { buildCalendarExportUrl } from "@/lib/calendar-sync";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("buildCalendarExportUrl", () => {
  it("uses the configured public app URL instead of the internal Next.js bind address", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://krymvokrug.ru";

    expect(buildCalendarExportUrl("https://0.0.0.0:3000/api/internal", "token-123")).toBe(
      "https://krymvokrug.ru/api/calendar/rooms/token-123.ics",
    );
  });

  it("falls back to the canonical site domain when the configured URL is local", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    expect(buildCalendarExportUrl("http://localhost:3000/api/internal", "local-token")).toBe(
      "https://krymvokrug.ru/api/calendar/rooms/local-token.ics",
    );
  });
});
