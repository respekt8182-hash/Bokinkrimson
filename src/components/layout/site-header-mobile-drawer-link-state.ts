type SearchParamsLike = Pick<URLSearchParams, "get"> | null | undefined;

type IsDrawerLinkActiveOptions = {
  pathname: string;
  searchParams?: SearchParamsLike;
  href: string;
  exact?: boolean;
};

function hasMatchingQuery(searchParams: SearchParamsLike, href: string) {
  const [, hrefQuery = ""] = href.split("?");

  if (!hrefQuery) {
    return true;
  }

  if (!searchParams) {
    return false;
  }

  const hrefSearchParams = new URLSearchParams(hrefQuery);

  for (const [key, value] of hrefSearchParams.entries()) {
    if (searchParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

function isLegacyDirectionPath(
  pathname: string,
  searchParams: SearchParamsLike,
  direction: string,
) {
  return pathname === "/search" && searchParams?.get("direction") === direction;
}

function isHousingPath(pathname: string) {
  return (
    pathname === "/rent" ||
    pathname.startsWith("/rent/") ||
    pathname === "/crimea" ||
    (pathname.startsWith("/crimea/") && !pathname.startsWith("/crimea/excursions/"))
  );
}

function isExcursionsPath(pathname: string) {
  return (
    pathname === "/excursions" ||
    pathname.startsWith("/excursions/") ||
    pathname.startsWith("/crimea/excursions/")
  );
}

function isToursPath(pathname: string) {
  return pathname === "/tours" || pathname.startsWith("/tours/");
}

export function isDrawerLinkActive({
  pathname,
  searchParams,
  href,
  exact = false,
}: IsDrawerLinkActiveOptions) {
  const hrefPathname = href.split("?")[0];

  if (exact) {
    return pathname === hrefPathname && hasMatchingQuery(searchParams, href);
  }

  if (hrefPathname === "/rent") {
    return isHousingPath(pathname) || isLegacyDirectionPath(pathname, searchParams, "housing");
  }

  if (hrefPathname === "/excursions") {
    return isExcursionsPath(pathname) || isLegacyDirectionPath(pathname, searchParams, "excursions");
  }

  if (hrefPathname === "/tours") {
    return isToursPath(pathname) || isLegacyDirectionPath(pathname, searchParams, "tours");
  }

  if (href.includes("?")) {
    return pathname === hrefPathname && hasMatchingQuery(searchParams, href);
  }

  return pathname === hrefPathname || pathname.startsWith(`${hrefPathname}/`);
}
