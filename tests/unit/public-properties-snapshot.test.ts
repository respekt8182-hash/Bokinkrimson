// Unit tests for published property snapshot creation, parsing, and edit fallback rules.
import { PetsPolicy, PropertyStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolvePublicCatalogDisplayState } from "../../src/lib/public-properties";

describe("public catalog display state", () => {
  it("prefers the approved snapshot when a published property has pending edits", () => {
    const state = resolvePublicCatalogDisplayState({
      status: PropertyStatus.PUBLISHED,
      pendingEditStatus: PropertyStatus.DRAFT,
      publishedSnapshot: {
        property: {
          name: "Одобренный объект",
          type: "hotel",
          locationId: "yalta",
          locationName: "Ялта",
          address: "Набережная, 1",
          seaDistance: "120 м",
          latitude: 44.4952,
          longitude: 34.1663,
          description: "Проверенная версия карточки",
          faqItems: [],
          phone: "+7 999 111-11-11",
          websiteUrl: null,
          contactEmail: null,
          showEmail: false,
          whatsappUrl: null,
          telegramUrl: null,
          vkUrl: null,
          maxUrl: null,
          okUrl: null,
          receiveRequests: true,
          checkInFrom: "14:00",
          checkOutUntil: "12:00",
          childrenAllowed: false,
          childrenMinAge: null,
          petsPolicy: PetsPolicy.FORBIDDEN,
          smokingPolicy: "FORBIDDEN",
          quietHoursEnabled: false,
          quietHoursFrom: null,
          quietHoursTo: null,
          parkingInfo: null,
          mealOptions: null,
          prepaymentPolicy: null,
          classificationApplicable: true,
          registryNumber: "KSR-1",
          registryDetails: null,
          starRating: 3,
        },
        media: [
          {
            id: "media-approved",
            propertyId: "property-1",
            roomId: null,
            type: "IMAGE",
            url: "/approved-cover.webp",
            mimeType: "image/webp",
            fileSize: 12345,
            originalName: "approved.jpg",
            sortOrder: 1,
            createdAt: "2026-03-01T00:00:00.000Z",
          },
        ],
        amenities: [],
        customAmenities: [],
        keyRoomAmenityNames: [],
        rooms: [
          {
            id: "room-approved",
            propertyId: "property-1",
            title: "Стандарт",
            beds: 2,
            extraBeds: 0,
            roomsCount: 1,
            areaSqm: 22,
            bathroomType: "IN_ROOM",
            bathroomTypeLabel: "В номере",
            meta: null,
            isActive: true,
            featureIds: [],
            features: [],
            customFeatures: [],
            media: [],
            mediaStats: {
              imageCount: 0,
              videoCount: 0,
            },
            prices: [
              {
                id: "price-approved",
                roomId: "room-approved",
                dateFrom: "2026-06-01",
                dateTo: "2026-06-30",
                price: 4200,
                minGuests: null,
                currency: "RUB",
                createdAt: "2026-03-01T00:00:00.000Z",
                updatedAt: "2026-03-01T00:00:00.000Z",
              },
            ],
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      },
      name: "Черновик объекта",
      type: "guest_house",
      locationId: "sudak",
      locationName: "Судак",
      address: "Черновой адрес, 7",
      seaDistance: "20 м",
      latitude: 44.8504,
      longitude: 34.9747,
      description: "Непроверенная версия карточки",
      checkInFrom: "15:00",
      childrenAllowed: true,
      petsPolicy: PetsPolicy.ALLOWED,
      starRating: 5,
      media: [{ url: "/draft-cover.webp" }],
      rooms: [
        {
          id: "room-draft",
          title: "Люкс",
          beds: 4,
          extraBeds: 2,
          areaSqm: 60,
          prices: [
            {
              dateFrom: new Date("2026-06-01T00:00:00.000Z"),
              dateTo: new Date("2026-06-30T00:00:00.000Z"),
              price: 9900,
              minGuests: 1,
              currency: "RUB",
            },
          ],
        },
      ],
    });

    expect(state.name).toBe("Одобренный объект");
    expect(state.type).toBe("hotel");
    expect(state.locationId).toBe("yalta");
    expect(state.imageUrls).toEqual(["/approved-cover.webp"]);
    expect(state.rooms.map((room) => room.id)).toEqual(["room-approved"]);
    expect(state.rooms[0]?.prices[0]?.price).toBe(4200);
  });

  it("falls back to live data when there is no pending edit snapshot", () => {
    const state = resolvePublicCatalogDisplayState({
      status: PropertyStatus.PUBLISHED,
      pendingEditStatus: null,
      publishedSnapshot: null,
      name: "Живая карточка",
      type: "guest_house",
      locationId: "sudak",
      locationName: "Судак",
      address: "Улица, 10",
      seaDistance: null,
      latitude: null,
      longitude: null,
      description: "Текущая версия",
      checkInFrom: "13:00",
      childrenAllowed: true,
      petsPolicy: PetsPolicy.ON_REQUEST,
      starRating: 4,
      media: [{ url: "/live-cover.webp" }],
      rooms: [
        {
          id: "room-live",
          title: "Комфорт",
          beds: 3,
          extraBeds: 1,
          areaSqm: 30,
          prices: [
            {
              dateFrom: new Date("2026-07-01T00:00:00.000Z"),
              dateTo: new Date("2026-07-31T00:00:00.000Z"),
              price: 5400,
              minGuests: null,
              currency: "RUB",
            },
          ],
        },
      ],
    });

    expect(state.name).toBe("Живая карточка");
    expect(state.imageUrls).toEqual(["/live-cover.webp"]);
    expect(state.rooms.map((room) => room.id)).toEqual(["room-live"]);
    expect(state.rooms[0]?.prices[0]?.price).toBe(5400);
  });
});
