// Next.js page for route /dashboard.
import {
  ArrowRight,
  Bus,
  Building2,
  MessageSquareText,
  Search,
  TentTree,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { getSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-olive/10 bg-cream/70 p-4 sm:p-5">
        <p className="text-sm font-semibold text-primary">Личный кабинет</p>
        <h1 className="mt-1 text-2xl font-semibold text-olive sm:text-3xl">
          Что вы хотите сделать?
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-olive/70">
          Здесь владельцы управляют объявлениями о недвижимости, экскурсиях и трансферах. Если вы
          гость и хотите оставить отзыв, перейдите к поиску на сайте и откройте нужную карточку.
        </p>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <Link
          href="/"
          className="group flex min-h-[190px] flex-col justify-between rounded-2xl border border-primary/16 bg-white p-4 text-olive shadow-sm transition hover:border-primary/28 hover:bg-foam/45 sm:p-5"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AppIcon icon={MessageSquareText} className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-semibold">Оставить отзыв</span>
            <span className="mt-1 block text-sm leading-relaxed text-olive/62">
              Откроется главная страница с поиском. Найдите недвижимость, экскурсию или трансфер и
              перейдите к отзывам в карточке.
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            Перейти к поиску
            <AppIcon icon={Search} className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <section className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">Размещение объявлений</p>
              <h2 className="mt-1 text-xl font-semibold text-olive">Мои разделы</h2>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link
              href="/dashboard/objects"
              className="group rounded-xl border border-olive/10 bg-cream/45 p-3 transition hover:border-primary/25 hover:bg-foam/65"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary ring-1 ring-primary/10">
                <AppIcon icon={Building2} className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-base font-semibold text-olive">Недвижимость</span>
              <span className="mt-1 block text-xs leading-relaxed text-olive/58">
                Жильё, номера, удобства, календарь и публикация.
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Открыть
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/dashboard/excursions"
              className="group rounded-xl border border-olive/10 bg-cream/45 p-3 transition hover:border-terra/25 hover:bg-terra/5"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-terra ring-1 ring-terra/10">
                <AppIcon icon={TentTree} className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-base font-semibold text-olive">Экскурсии</span>
              <span className="mt-1 block text-xs leading-relaxed text-olive/58">
                Маршруты, программы, расписание и заявки гостей.
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-terra">
                Открыть
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/dashboard/transfers"
              className="group rounded-xl border border-olive/10 bg-cream/45 p-3 transition hover:border-sage/40 hover:bg-sage/10"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-olive ring-1 ring-sage/25">
                <AppIcon icon={Bus} className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-base font-semibold text-olive">Трансферы</span>
              <span className="mt-1 block text-xs leading-relaxed text-olive/58">
                Автопарк, направления, цены и публикация услуги.
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-olive">
                Открыть
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>

        </section>
      </div>
    </div>
  );
}
