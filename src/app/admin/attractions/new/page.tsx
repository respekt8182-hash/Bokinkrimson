import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPanel, adminInputClass } from "@/components/admin/admin-ui";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { createAttractionDraft } from "@/lib/public-marketplace";

export default async function AdminCreateAttractionPage() {
  async function createAttraction(formData: FormData) {
    "use server";

    const admin = await verifyAdminSession();
    if (!admin) {
      redirect("/admin/login");
    }

    const created = await createAttractionDraft({
      title: (formData.get("title") as string | null)?.trim() || null,
      createdByLogin: admin.login,
    });

    redirect(`/admin/attractions/${created.id}`);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Новая достопримечательность"
        description="Создайте черновик места. Потом можно добавить город, координаты, описание и фотографии."
        actions={
          <Link
            href="/admin/attractions"
            className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
          >
            К каталогу
          </Link>
        }
      />

      <AdminPanel title="Первичные данные">
        <form action={createAttraction} className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Название</span>
            <input
              name="title"
              placeholder="Например: Воронцовский дворец"
              className={adminInputClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover md:w-auto"
            >
              Создать
            </button>
          </div>
        </form>
      </AdminPanel>
    </div>
  );
}
