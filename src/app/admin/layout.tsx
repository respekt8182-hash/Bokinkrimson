// Layout wrapper for route segment /admin.
import { redirect } from "next/navigation";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { getSession } from "@/lib/auth";
import { getAdminModerationSnapshot } from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

const menu = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/moderation", label: "Модерация жилья" },
  { href: "/admin/moderation/excursions", label: "Модерация экскурсий" },
  { href: "/admin/messages", label: "Сообщения" },
  { href: "/admin/objects", label: "Объекты" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/password-resets", label: "Сбросы паролей" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/admin");
  }

  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const moderationSnapshot = await getAdminModerationSnapshot();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="grid gap-4 md:grid-cols-[230px_1fr]">
        <aside className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10">
          <p className="text-xs uppercase tracking-wide text-olive/60">Админ-панель</p>
          <p className="mt-1 text-sm font-semibold text-olive">
            {session.firstName} {session.lastName}
          </p>
          <AdminSidebarNav menu={menu} moderationSnapshot={moderationSnapshot} />
        </aside>
        <section className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5">
          {children}
        </section>
      </div>
    </div>
  );
}
