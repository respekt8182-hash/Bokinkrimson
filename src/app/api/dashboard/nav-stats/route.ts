// Dashboard nav stats endpoint: lightweight polling API for unread booking counters in header/sidebar badges.
import { ApplicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const bookingsNewCount = await db.application.count({
    where: {
      status: ApplicationStatus.NEW,
      OR: [
        {
          property: {
            ownerId: session.id,
            ownerDeletedAt: null,
          },
        },
        {
          excursion: {
            ownerId: session.id,
          },
        },
      ],
    },
  });

  return NextResponse.json({ bookingsNewCount });
}
