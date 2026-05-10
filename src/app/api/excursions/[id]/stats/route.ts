import {
  handleListingAnalyticsGet,
  handleListingAnalyticsRefresh,
} from "@/lib/listing-analytics-route-handlers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleListingAnalyticsGet(request, "excursion", id);
}

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleListingAnalyticsRefresh("excursion", id);
}
