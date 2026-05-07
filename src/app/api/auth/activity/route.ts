// API route handler for /api/auth/activity.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markUserSeen } from "@/lib/user-activity";

export async function POST() {
  const session = await getSession();

  if (!session || session.role !== "USER") {
    return new NextResponse(null, { status: 204 });
  }

  await markUserSeen(session.id);

  return new NextResponse(null, { status: 204 });
}
