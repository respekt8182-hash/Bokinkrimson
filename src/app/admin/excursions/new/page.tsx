// Admin page: create a new excursion and assign to a user.
import { redirect } from "next/navigation";
import { ExcursionOfferType } from "@prisma/client";
import { db } from "@/lib/db";
import { AdminCreateExcursionForm } from "@/components/admin/admin-create-excursion-form";

export default async function AdminCreateExcursionPage() {
  const users = await db.user.findMany({
    where: { role: "USER" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  async function createExcursion(formData: FormData) {
    "use server";
    const ownerId = formData.get("ownerId") as string;
    const offerType = formData.get("offerType") as string;
    const title = (formData.get("title") as string)?.trim() || null;

    if (!ownerId) return;

    const created = await db.excursion.create({
      data: {
        ownerId,
        offerType:
          offerType === ExcursionOfferType.TOUR
            ? ExcursionOfferType.TOUR
            : ExcursionOfferType.EXCURSION,
        title,
      },
    });

    redirect(`/admin/excursions/${created.id}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-olive">Создать экскурсию</h1>
        <p className="mt-1 text-sm text-olive/55">
          Создайте экскурсию или тур и назначьте владельца.
        </p>
      </div>

      <AdminCreateExcursionForm users={users} action={createExcursion} />
    </div>
  );
}
