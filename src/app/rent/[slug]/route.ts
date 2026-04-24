import { NextResponse } from "next/server";
import { getPublicPropertyByIdentifier } from "@/lib/public-properties";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const item = await getPublicPropertyByIdentifier(slug);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(item.path, request.url), 308);
}
