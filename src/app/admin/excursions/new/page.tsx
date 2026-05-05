// Admin page: create a new excursion and assign to a user.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExcursionOfferType } from "@prisma/client";
import {
  countOwnerActiveExcursionDrafts,
  OWNER_ACTIVE_EXCURSION_DRAFT_LIMIT,
} from "@/lib/admin-entity-lifecycle";
import {
  AdminPageHeader,
  AdminUnavailableState,
} from "@/components/admin/admin-ui";
import { AdminCreateExcursionForm } from "@/components/admin/admin-create-excursion-form";
import { PlacementPromoNotice } from "@/components/pricing/placement-promo";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { db } from "@/lib/db";
import { createExcursionDraft } from "@/lib/excursions";

type AdminCreateExcursionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getErrorMessage(value: string | string[] | undefined): string | null {
  const code = Array.isArray(value) ? value[0] : value;

  if (code === "draft-limit") {
    return `У владельца уже есть ${OWNER_ACTIVE_EXCURSION_DRAFT_LIMIT} черновика экскурсии или тура. Освободите один слот, чтобы создать новую карточку.`;
  }

  return null;
}

export default async function AdminCreateExcursionPage({
  searchParams,
}: AdminCreateExcursionPageProps) {
  const { users, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-excursions-create",
      unavailableMessage:
        "Admin excursion creation page: database is unavailable. Rendering unavailable state.",
      fallbackEligibleMessage:
        "Admin excursion creation page: database is unavailable or credentials are invalid. Rendering unavailable state.",
    },
    async () => ({
      users: await db.user.findMany({
        where: { role: "USER", deletedAt: null },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      isDatabaseFallback: false,
    }),
    { users: [], isDatabaseFallback: true },
  );
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  async function createExcursion(formData: FormData) {
    "use server";
    const ownerId = formData.get("ownerId") as string;
    const offerType = formData.get("offerType") as string;
    const title = (formData.get("title") as string)?.trim() || null;

    if (!ownerId) return;

    const activeDrafts = await countOwnerActiveExcursionDrafts(db, ownerId);
    if (activeDrafts >= OWNER_ACTIVE_EXCURSION_DRAFT_LIMIT) {
      redirect("/admin/excursions/new?error=draft-limit");
    }

    const created = await createExcursionDraft(db, {
      ownerId,
      offerType:
        offerType === ExcursionOfferType.TOUR
          ? ExcursionOfferType.TOUR
          : ExcursionOfferType.EXCURSION,
      title,
    });

    redirect(`/admin/excursions/${created.id}`);
  }

  if (isDatabaseFallback) {
    return (
      <AdminUnavailableState
        backHref="/admin/excursions"
        backLabel="К каталогу экскурсий"
        title="Создание экскурсии временно недоступно"
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Новая экскурсия"
        description="Создайте карточку и сразу назначьте владельца."
        actions={
          <Link
            href="/admin/excursions"
            className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
          >
            К каталогу экскурсий
          </Link>
        }
      />
      <PlacementPromoNotice compact />

      <AdminCreateExcursionForm
        users={users}
        action={createExcursion}
        errorMessage={errorMessage}
      />
    </div>
  );
}
