// Next.js page for route /dashboard/profile.
import { notFound } from "next/navigation";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardProfilePage() {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      phoneVerifiedAt: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          favoriteProperties: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const { _count, ...profile } = user;

  return (
    <ProfileSettings
      initialProfile={{
        ...profile,
        phoneVerifiedAt: profile.phoneVerifiedAt?.toISOString() ?? null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      }}
      favoriteCount={_count.favoriteProperties}
      reviewCount={_count.reviews}
    />
  );
}
