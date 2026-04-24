// Next.js page for route /dashboard/profile.
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { areDatabaseColumnsAvailable, db } from "@/lib/db";

const USER_EMAIL_CHANGE_COLUMNS = [
  "pendingEmail",
  "emailChangeTokenHash",
  "emailChangeTokenExpiresAt",
  "emailChangeRequestedAt",
  "emailVerifiedAt",
] as const;
const USER_PASSWORD_SECURITY_COLUMNS = ["passwordChangedAt", "sessionVersion"] as const;

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
      email: true,
      phone: true,
      avatarUrl: true,
      updatedAt: true,
    },
  });

  if (!user) {
    notFound();
  }

  const [isEmailChangeAvailable, isPasswordChangeAvailable] = await Promise.all([
    areDatabaseColumnsAvailable("User", USER_EMAIL_CHANGE_COLUMNS),
    areDatabaseColumnsAvailable("User", USER_PASSWORD_SECURITY_COLUMNS),
  ]);

  return (
    <ProfileSettings
      initialProfile={{
        ...user,
        updatedAt: user.updatedAt.toISOString(),
      }}
      emailChangeAvailable={isEmailChangeAvailable}
      emailChangeUnavailableReason={
        isEmailChangeAvailable
          ? null
          : "Смена email временно недоступна: база данных еще не обновлена до последней миграции."
      }
      passwordChangeAvailable={isPasswordChangeAvailable}
      passwordChangeUnavailableReason={
        isPasswordChangeAvailable
          ? null
          : "Смена пароля временно недоступна: база данных еще не обновлена до последней миграции."
      }
    />
  );
}
