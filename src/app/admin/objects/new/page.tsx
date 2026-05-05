// Admin page: create a new property and assign to a user.
import { redirect } from "next/navigation";
import {
  countOwnerActivePropertyDrafts,
  OWNER_ACTIVE_PROPERTY_DRAFT_LIMIT,
} from "@/lib/admin-entity-lifecycle";
import { db } from "@/lib/db";
import { createPropertyDraft } from "@/lib/properties";
import { AdminCreatePropertyForm } from "@/components/admin/admin-create-property-form";
import { PlacementPromoNotice } from "@/components/pricing/placement-promo";

type AdminCreatePropertyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getErrorMessage(value: string | string[] | undefined): string | null {
  const code = Array.isArray(value) ? value[0] : value;

  if (code === "draft-limit") {
    return `У владельца уже есть ${OWNER_ACTIVE_PROPERTY_DRAFT_LIMIT} черновика объекта. Освободите один слот, чтобы создать новый.`;
  }

  return null;
}

export default async function AdminCreatePropertyPage({
  searchParams,
}: AdminCreatePropertyPageProps) {
  const users = await db.user.findMany({
    where: { role: "USER", deletedAt: null },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  async function createProperty(formData: FormData) {
    "use server";
    const ownerId = formData.get("ownerId") as string;
    const name = (formData.get("name") as string)?.trim() || null;
    const type = (formData.get("type") as string)?.trim() || null;

    if (!ownerId) return;

    const activeDrafts = await countOwnerActivePropertyDrafts(db, ownerId);
    if (activeDrafts >= OWNER_ACTIVE_PROPERTY_DRAFT_LIMIT) {
      redirect("/admin/objects/new?error=draft-limit");
    }

    const created = await createPropertyDraft(db, {
      ownerId,
      name,
      type,
    });

    redirect(`/admin/objects/${created.id}/about`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-olive">Создать объект</h1>
        <p className="mt-1 text-sm text-olive/55">
          Создайте объект размещения и назначьте владельца.
        </p>
      </div>
      <PlacementPromoNotice compact />

      <AdminCreatePropertyForm
        users={users}
        action={createProperty}
        errorMessage={errorMessage}
      />
    </div>
  );
}
