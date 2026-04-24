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
      avatarUrl: true,
      updatedAt: true,
    },
  });

  if (!user) {
    notFound();
  }

  return (
    <ProfileSettings
      initialProfile={{
        ...user,
        updatedAt: user.updatedAt.toISOString(),
      }}
    />
  );
}
