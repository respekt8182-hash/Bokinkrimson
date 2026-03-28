// Next.js page for route /rent.
import { redirect } from "next/navigation";

type RentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function RentPage({ searchParams }: RentPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  query.set("direction", "housing");
  const allowed = [
    "q",
    "location",
    "propertyType",
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
