import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createRoomSchema } from "../../src/lib/schemas";

type RoomPayload = z.input<typeof createRoomSchema>;
type RoomPayloadOverrides = Omit<Partial<RoomPayload>, "meta"> & {
  meta?: Partial<RoomPayload["meta"]>;
};

function makeBaseRoomPayload(): RoomPayload {
  return {
    title: "Тестовый номер",
    beds: 2,
    extraBeds: 0,
    roomsCount: 1,
    areaSqm: 24,
    bathroomType: "IN_ROOM" as const,
    featureIds: [],
    customFeatures: [],
    meta: {
      roomType: "double_two_beds" as const,
      roomName: "Двухместный номер с 2 отдельными кроватями",
      nameInExtranet: null,
      bedConfiguration: [{ type: "single" as const, count: 2 }],
      bedSets: [[{ type: "single" as const, count: 2 }]],
      hasAdditionalPlaces: false,
      additionalPlaceTypes: [],
      hasPrivateBathroom: true,
      privateBathroomLocations: ["in_room" as const],
      privateToiletLocations: ["in_room" as const],
      hasSharedBathroom: false,
      sharedBathroomLocations: [],
      sharedToiletLocations: [],
      privateBathroomCount: 1,
    },
  };
}

function makeRoomPayload(overrides: RoomPayloadOverrides = {}): RoomPayload {
  const base = makeBaseRoomPayload();

  return {
    ...base,
    ...overrides,
    meta: {
      ...base.meta,
      ...(overrides.meta ?? {}),
    },
  };
}

describe("room schema bed logic", () => {
  it("accepts a twin room with two semi-double beds", () => {
    const result = createRoomSchema.safeParse(
      makeRoomPayload({
        meta: {
          roomType: "double_two_beds",
          roomName: "Двухместный номер с 2 отдельными кроватями",
          bedConfiguration: [{ type: "semi_double", count: 2 }],
          bedSets: [[{ type: "semi_double", count: 2 }]],
        },
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects invalid bed types for a double room with one bed", () => {
    const result = createRoomSchema.safeParse(
      makeRoomPayload({
        meta: {
          roomType: "double_one_bed",
          roomName: "Двухместный номер с 1 кроватью",
          bedConfiguration: [{ type: "single", count: 2 }],
          bedSets: [[{ type: "single", count: 2 }]],
        },
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("нельзя использовать"))).toBe(
        true,
      );
    }
  });

  it("rejects manual capacity changes for fixed room categories", () => {
    const result = createRoomSchema.safeParse(
      makeRoomPayload({
        beds: 4,
        meta: {
          roomType: "triple",
          roomName: "Трехместный номер",
          bedConfiguration: [{ type: "single", count: 4 }],
          bedSets: [[{ type: "single", count: 4 }]],
        },
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes("количество основных мест фиксировано")),
      ).toBe(true);
    }
  });

  it("keeps family rooms flexible by allowing custom main places", () => {
    const result = createRoomSchema.safeParse(
      makeRoomPayload({
        beds: 5,
        meta: {
          roomType: "family",
          roomName: "Семейный номер",
          bedConfiguration: [
            { type: "double_queen", count: 2 },
            { type: "single", count: 1 },
          ],
          bedSets: [
            [
              { type: "double_queen", count: 2 },
              { type: "single", count: 1 },
            ],
          ],
        },
      }),
    );

    expect(result.success).toBe(true);
  });
});
