// Next.js page for route /excursions.
import { redirect } from "next/navigation";

type ExcursionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function ExcursionsPage({ searchParams }: ExcursionsPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  query.set("direction", "excursions");
  const allowed = [
    "q",
    "location",
    "district",
    "category",
    "format",
    "durationBucket",
    "language",
    "difficulty",
    "pickup",
    "kids",
    "radiusKm",
    "checkIn",
    "checkOut",
    "guests",
    "minPrice",
    "maxPrice",
    "sort",
    "page",
  ] as const;

  for (const key of allowed) {
    const value = pick(params[key]);
    if (value) {
      query.set(key, value);
    }
  }

  redirect(`/search?${query.toString()}`);
}
