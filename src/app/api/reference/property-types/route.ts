// API route handler for /api/reference/property-types.
import { NextResponse } from "next/server";
import { propertyTypes } from "@/lib/constants";

export async function GET() {
  return NextResponse.json({ items: propertyTypes });
}
