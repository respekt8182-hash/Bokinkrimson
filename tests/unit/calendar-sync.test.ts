import { afterEach, describe, expect, it } from "vitest";
import { buildCalendarExportUrl, validateCalendarImportSourcesInput } from "@/lib/calendar-sync";

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

describe("validateCalendarImportSourcesInput", () => {
  it("accepts several named import sources", () => {
    const result = validateCalendarImportSourcesInput([
      {
        label: "Booking",
        importUrl: "https://booking.example/calendar.ics#private",
        isEnabled: true,
      },
      {
        label: "Ostrovok",
        importUrl: "https://ostrovok.example/room.ics",
        isEnabled: false,
      },
    ]);

    expect(result).toEqual({
      ok: true,
      sources: [
        {
          label: "Booking",
          importUrl: "https://booking.example/calendar.ics",
          isEnabled: true,
          id: undefined,
        },
        {
          label: "Ostrovok",
          importUrl: "https://ostrovok.example/room.ics",
          isEnabled: false,
          id: undefined,
        },
      ],
    });
  });

  it("rejects duplicate import links", () => {
    const result = validateCalendarImportSourcesInput([
      {
        label: "First",
        importUrl: "https://calendar.example/room.ics",
        isEnabled: true,
      },
      {
        label: "Second",
        importUrl: "https://calendar.example/room.ics",
        isEnabled: true,
      },
    ]);

    expect(result).toEqual({ ok: false, error: "Эта ссылка уже добавлена" });
  });
});
