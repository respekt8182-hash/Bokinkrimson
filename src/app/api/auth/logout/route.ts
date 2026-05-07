// API route handler for /api/auth/logout.
import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { markUserLogout } from "@/lib/user-activity";

export async function POST() {
  const session = await getSession();

  if (session?.role === "USER") {
    await markUserLogout(session.id);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
