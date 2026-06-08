import { afterEach, describe, expect, it } from "vitest";
import {
  buildPublicCatalogExcursionVisibilityWhere,
  buildPublicCatalogPropertyVisibilityWhere,
} from "../../src/lib/public-visibility";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  process.env.NODE_ENV = originalNodeEnv;
});

describe("public catalog visibility", () => {
  it("keeps demo content visible outside production", () => {
    process.env.NODE_ENV = "development";

    expect(buildPublicCatalogPropertyVisibilityWhere()).toEqual({
      status: "PUBLISHED",
      isPublishedVisible: true,
      ownerDeletedAt: null,
      owner: {
        is: {
          deletedAt: null,
        },
      },
    });

    expect(buildPublicCatalogExcursionVisibilityWhere()).toEqual({
      status: "PUBLISHED",
      isPublishedVisible: true,
      deletedAt: null,
      owner: {
        is: {
          deletedAt: null,
        },
      },
    });
  });

  it("still excludes demo content in production", () => {
    process.env.NODE_ENV = "production";

    expect(buildPublicCatalogPropertyVisibilityWhere()).toEqual({
      AND: [
        {
          status: "PUBLISHED",
          isPublishedVisible: true,
          ownerDeletedAt: null,
          owner: {
            is: {
              deletedAt: null,
            },
          },
        },
        {
          NOT: {
            id: {
              startsWith: "demo_property_",
            },
          },
        },
      ],
    });

    expect(buildPublicCatalogExcursionVisibilityWhere()).toEqual({
      AND: [
        {
          status: "PUBLISHED",
          isPublishedVisible: true,
          deletedAt: null,
          owner: {
            is: {
              deletedAt: null,
            },
          },
        },
        {
          NOT: [
            {
              id: {
                startsWith: "demo_excursion_",
              },
            },
            {
              id: {
                startsWith: "demo_tour_",
              },
            },
          ],
        },
      ],
    });
  });
});
