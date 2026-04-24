import { NextResponse } from "next/server";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";
import { hashSecurityToken } from "@/lib/security-emails";

const USER_EMAIL_CHANGE_COLUMNS = [
  "pendingEmail",
  "emailChangeTokenHash",
  "emailChangeTokenExpiresAt",
  "emailChangeRequestedAt",
  "emailVerifiedAt",
] as const;

function buildRedirectUrl(request: Request, status: "success" | "invalid" | "conflict") {
  const url = new URL("/dashboard/profile", request.url);
  url.searchParams.set("email_verify", status);
  return url;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.redirect(buildRedirectUrl(request, "invalid"));
  }

  if (!(await areDatabaseColumnsAvailable("User", USER_EMAIL_CHANGE_COLUMNS))) {
    return NextResponse.redirect(buildRedirectUrl(request, "invalid"));
  }

  const tokenHash = hashSecurityToken(token);
  const now = new Date();
  const existing = await db.user.findFirst({
    where: {
      emailChangeTokenHash: tokenHash,
      emailChangeTokenExpiresAt: {
        gt: now,
      },
      pendingEmail: {
        not: null,
      },
    },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
    },
  });

  if (!existing?.pendingEmail) {
    return NextResponse.redirect(buildRedirectUrl(request, "invalid"));
  }

  const conflict = await db.user.findFirst({
    where: {
      id: { not: existing.id },
      email: existing.pendingEmail,
    },
    select: { id: true },
  });

  if (conflict) {
    return NextResponse.redirect(buildRedirectUrl(request, "conflict"));
  }

  await db.user.update({
    where: { id: existing.id },
    data: {
      email: existing.pendingEmail,
      pendingEmail: null,
      emailChangeTokenHash: null,
      emailChangeTokenExpiresAt: null,
      emailChangeRequestedAt: null,
      emailVerifiedAt: now,
      sessionVersion: {
        increment: 1,
      },
    },
  });

  return NextResponse.redirect(buildRedirectUrl(request, "success"));
}
