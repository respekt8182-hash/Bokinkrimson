// Next.js page for route /dashboard.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-olive">Главная</h1>
        <p className="mt-1 text-sm text-olive/70">Выберите нужный раздел для работы.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/objects"
          className="flex min-h-[180px] items-center rounded-2xl border border-olive/15 bg-white p-6 text-3xl font-semibold text-olive transition hover:border-olive/30 hover:bg-cream/40 md:p-8 md:text-4xl"
        >
          Объекты
        </Link>

        <Link
          href="/dashboard/excursions"
          className="flex min-h-[180px] items-center rounded-2xl border border-olive/15 bg-white p-6 text-3xl font-semibold text-olive transition hover:border-olive/30 hover:bg-cream/40 md:p-8 md:text-4xl"
        >
          Экскурсии / Туры
        </Link>
      </div>
    </div>
  );
}
