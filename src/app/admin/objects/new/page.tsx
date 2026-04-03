// Admin page: create a new property and assign to a user.
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AdminCreatePropertyForm } from "@/components/admin/admin-create-property-form";

export default async function AdminCreatePropertyPage() {
  const users = await db.user.findMany({
    where: { role: "USER" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  async function createProperty(formData: FormData) {
    "use server";
    const ownerId = formData.get("ownerId") as string;
    const name = (formData.get("name") as string)?.trim() || null;
    const type = (formData.get("type") as string)?.trim() || null;

    if (!ownerId) return;

    const created = await db.property.create({
      data: {
        ownerId,
        name,
        type,
      },
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

      <AdminCreatePropertyForm users={users} action={createProperty} />
    </div>
  );
}
