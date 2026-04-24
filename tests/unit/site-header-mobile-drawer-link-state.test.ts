import { describe, expect, it } from "vitest";
import { isDrawerLinkActive } from "../../src/components/layout/site-header-mobile-drawer-link-state";

describe("isDrawerLinkActive", () => {
  it("marks housing active for clean and legacy housing routes only", () => {
    const legacyHousingParams = new URLSearchParams("direction=housing&guests=2");

    expect(
      isDrawerLinkActive({
        pathname: "/rent",
        href: "/rent",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/crimea/yalta",
        href: "/rent",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/search",
        searchParams: legacyHousingParams,
        href: "/rent",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/crimea/excursions/yalta/balaklava-na-katere",
        href: "/rent",
      }),
    ).toBe(false);
  });

  it("marks excursions active for clean and legacy excursion routes only", () => {
    const legacyExcursionsParams = new URLSearchParams("direction=excursions&radiusKm=10");

    expect(
      isDrawerLinkActive({
        pathname: "/excursions/yalta",
        href: "/excursions",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/crimea/excursions/yalta/balaklava-na-katere",
        href: "/excursions",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/search",
        searchParams: legacyExcursionsParams,
        href: "/excursions",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/tours",
        href: "/excursions",
      }),
    ).toBe(false);
  });

  it("marks tours active only for tours routes", () => {
    const legacyToursParams = new URLSearchParams("direction=tours&location=Ялта");

    expect(
      isDrawerLinkActive({
        pathname: "/tours",
        href: "/tours",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/search",
        searchParams: legacyToursParams,
        href: "/tours",
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/excursions/yalta",
        href: "/tours",
      }),
    ).toBe(false);
  });

  it("keeps exact links strict by pathname", () => {
    expect(
      isDrawerLinkActive({
        pathname: "/about",
        href: "/about",
        exact: true,
      }),
    ).toBe(true);

    expect(
      isDrawerLinkActive({
        pathname: "/about/team",
        href: "/about",
        exact: true,
      }),
    ).toBe(false);
  });
});
