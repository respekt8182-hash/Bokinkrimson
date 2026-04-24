import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страница не найдена",
  description: "Запрошенная страница не найдена. Вернитесь на главную и продолжите поиск жилья, туров и экскурсий по Крыму.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <section className="px-4 py-4 md:px-6 md:py-6">
      <div
        className="relative isolate flex min-h-[72vh] overflow-hidden rounded-[32px] bg-midnight shadow-[0_24px_80px_rgba(43,31,25,0.28)] md:min-h-[78vh]"
        style={{
          backgroundImage: "url('/404.png')",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

        <div className="relative z-10 flex w-full items-end p-5 md:p-8 lg:p-10">
          <div className="max-w-xl rounded-[28px] border border-white/20 bg-black/35 p-6 text-white backdrop-blur-md md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/75">Ошибка 404</p>
            <h1 className="mt-3 text-4xl leading-tight md:text-5xl">Страница не найдена</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/82 md:text-base">
              Возможно, ссылка устарела или нужная страница была перемещена. Вернитесь на
              главную, чтобы продолжить поиск.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-olive shadow-[0_14px_30px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 hover:bg-cream"
              >
                Вернуться на главную
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
