import { describe, expect, it } from "vitest";
import { parsePublishedPropertySnapshot } from "../../src/lib/property-public-snapshot";
import { serializeRoom } from "../../src/lib/rooms";

function makeRoomMeta(overrides: Record<string, unknown> = {}) {
  return {
    roomType: "double_two_beds",
    roomName: "Стандарт",
    floor: 2,
    nameInExtranet: null,
    bedConfiguration: [{ type: "single", count: 2 }],
    bedSets: [[{ type: "single", count: 2 }]],
    hasAdditionalPlaces: false,
    additionalPlaceTypes: [],
    hasPrivateBathroom: false,
    privateBathroomLocations: [],
    privateToiletLocations: [],
    hasSharedBathroom: false,
    sharedBathroomLocations: [],
    sharedToiletLocations: [],
    privateBathroomCount: null,
    ...overrides,
  };
}

function makeRoom() {
  return serializeRoom({
    id: "room-1",
    propertyId: "property-1",
    title: "Стандарт",
    beds: 2,
    extraBeds: 0,
    roomsCount: 1,
    areaSqm: null,
    bathroomType: "IN_ROOM",
    meta: makeRoomMeta({
      hasPrivateBathroom: true,
      privateBathroomLocations: ["on_floor"],
      privateToiletLocations: ["on_floor"],
      privateBathroomCount: 1,
    }),
    sortOrder: 0,
    isActive: true,
    createdAt: new Date("2026-05-08T00:00:00.000Z"),
    updatedAt: new Date("2026-05-08T00:00:00.000Z"),
  });
}

describe("room bathroom type normalization", () => {
  it("uses the selected on-floor location instead of the stale in-room type", () => {
    const room = makeRoom();

    expect(room.bathroomType).toBe("ON_FLOOR");
    expect(room.bathroomTypeLabel).toBe("На этаже");
  });

  it("repairs stale bathroom labels in published property snapshots", () => {
    const parsed = parsePublishedPropertySnapshot({
      property: {},
      media: [],
      amenities: [],
      customAmenities: [],
      keyRoomAmenityNames: [],
      rooms: [
        {
          ...makeRoom(),
          bathroomType: "IN_ROOM",
          bathroomTypeLabel: "В номере",
        },
      ],
    });

    expect(parsed?.rooms[0]?.bathroomType).toBe("ON_FLOOR");
    expect(parsed?.rooms[0]?.bathroomTypeLabel).toBe("На этаже");
  });
});
