// Unit tests for client-side housing search URL/query serialization.
import { describe, expect, it } from "vitest";
import {
  buildAccommodationSearchParams,
  buildHousingCatalogUrl,
  buildHousingMapQuery,
} from "../../src/lib/api/search";
import type { SearchFilters } from "../../src/types/catalog";

const baseFilters: SearchFilters = {
  direction: "housing",
  query: "",
  location: "",
  locationId: "",
  propertyType: "",
  checkIn: "",
  checkOut: "",
  guests: "2",
  guestsAdults: "2",
  guestsChildren: "0",
  minPrice: "",
  maxPrice: "",
  sort: "",
  minRating: "",
  hasPhotos: false,
  hasReviews: false,
  familyFriendly: false,
  petsAllowed: false,
  nearSea: false,
  hasPool: false,
  hasKitchen: false,
  hasAirConditioner: false,
  hasParking: false,
  smokingForbidden: false,
  quietHours: false,
  amenityIds: [],
  roomFeatureIds: [],
};

describe("housing search API helpers", () => {
  it("serializes extended accommodation filters for API requests", () => {
    const params = buildAccommodationSearchParams(
      {
        ...baseFilters,
        location: "Ялта",
        nearSea: true,
        hasPool: true,
        hasKitchen: true,
        hasAirConditioner: true,
        hasParking: true,
        smokingForbidden: true,
        quietHours: true,
        amenityIds: ["pool", "parking", "pool"],
        roomFeatureIds: ["air_conditioner", "private_kitchen"],
      },
      2,
      24,
      "44.4,33.9,44.7,34.2",
    );

    expect(params.get("nearSea")).toBe("1");
    expect(params.get("hasPool")).toBe("1");
    expect(params.get("hasKitchen")).toBe("1");
    expect(params.get("hasAirConditioner")).toBe("1");
    expect(params.get("hasParking")).toBe("1");
    expect(params.get("smokingForbidden")).toBe("1");
    expect(params.get("quietHours")).toBe("1");
    expect(params.get("amenityIds")).toBe("pool,parking");
    expect(params.get("roomFeatureIds")).toBe("air_conditioner,private_kitchen");
    expect(params.get("bounds")).toBe("44.4,33.9,44.7,34.2");
    expect(params.has("location")).toBe(false);
  });

  it("keeps extended filters in canonical housing URLs and map query", () => {
    const filters: SearchFilters = {
      ...baseFilters,
      location: "Ялта",
      locationId: "yalta",
      hasReviews: true,
      minRating: "4.5",
      nearSea: true,
      amenityIds: ["beach_access", "wifi"],
      roomFeatureIds: ["air_conditioner"],
    };

    expect(buildHousingCatalogUrl(filters)).toBe(
      "/crimea/yalta?minRating=4.5&hasReviews=1&nearSea=1&amenityIds=beach_access%2Cwifi&roomFeatureIds=air_conditioner",
    );

    const mapQuery = new URLSearchParams(buildHousingMapQuery(filters));
    expect(mapQuery.get("locationId")).toBe("yalta");
    expect(mapQuery.get("hasReviews")).toBe("1");
    expect(mapQuery.get("nearSea")).toBe("1");
    expect(mapQuery.get("amenityIds")).toBe("beach_access,wifi");
    expect(mapQuery.get("roomFeatureIds")).toBe("air_conditioner");
  });
});
