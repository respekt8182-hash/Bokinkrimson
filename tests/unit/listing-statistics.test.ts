import { describe, expect, it } from "vitest";
import { getListingStatsData } from "@/lib/listing-statistics";

const DAY = 24 * 60 * 60 * 1000;

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function buildMockClient() {
  const viewRows = [
    { date: utcDate("2026-05-10"), count: 10 },
    { date: utcDate("2026-05-08"), count: 5 },
    { date: utcDate("2026-04-15"), count: 7 },
    { date: utcDate("2025-11-30"), count: 99 },
  ];
  const actionRows = [
    { date: utcDate("2026-05-10"), actionType: "phone_primary", count: 2 },
    { date: utcDate("2026-05-10"), actionType: "whatsapp", count: 1 },
    { date: utcDate("2026-05-10"), actionType: "lead_phrase", count: 3 },
    { date: utcDate("2026-05-08"), actionType: "phone_secondary", count: 1 },
    { date: utcDate("2026-04-15"), actionType: "telegram", count: 4 },
    { date: utcDate("2026-04-15"), actionType: "website", count: 2 },
    { date: utcDate("2025-11-30"), actionType: "telegram", count: 99 },
  ];

  function inRange<T extends { date: Date }>(
    rows: T[],
    args: { where?: { date?: { gte?: Date; lt?: Date } } },
  ) {
    const gte = args.where?.date?.gte ?? new Date(0);
    const lt = args.where?.date?.lt ?? new Date(Date.now() + DAY);

    return rows.filter((row) => row.date >= gte && row.date < lt);
  }

  return {
    $queryRaw: async () => [{ table_name: "EngagementLog" }],
    viewLog: {
      findMany: async (args: { where?: { date?: { gte?: Date; lt?: Date } } }) =>
        inRange(viewRows, args),
    },
    engagementLog: {
      findMany: async (args: { where?: { date?: { gte?: Date; lt?: Date } } }) =>
        inRange(actionRows, args),
    },
  };
}

describe("getListingStatsData", () => {
  it("aggregates target actions by rolling periods and months", async () => {
    const stats = await getListingStatsData({
      entityType: "property",
      entityId: "property_1",
      totalViews: 42,
      now: utcDate("2026-05-10"),
      client: buildMockClient() as never,
    });

    expect(stats.monthlyHistory.map((item) => item.month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(stats.periodViews).toBe(22);
    expect(stats.periodActions).toBe(13);

    expect(stats.actionSummary.today).toMatchObject({
      total: 6,
      phoneActions: 2,
      messengerActions: 1,
      leadActions: 3,
      websiteActions: 0,
    });
    expect(stats.actionSummary.week).toMatchObject({
      total: 7,
      phoneActions: 3,
      messengerActions: 1,
      leadActions: 3,
    });
    expect(stats.actionSummary.month30).toMatchObject({
      total: 13,
      phoneActions: 3,
      messengerActions: 5,
      leadActions: 3,
      websiteActions: 2,
    });

    const april = stats.monthlyHistory.find((item) => item.month === "2026-04");
    const may = stats.monthlyHistory.find((item) => item.month === "2026-05");

    expect(april).toMatchObject({
      views: 7,
      actions: 6,
      messengerActions: 4,
      websiteActions: 2,
    });
    expect(may).toMatchObject({
      views: 15,
      actions: 7,
      phoneActions: 3,
      leadActions: 3,
    });
  });
});
