// Global 404 page for unknown routes.
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
        <h1 className="text-3xl text-olive">Страница не найдена</h1>
        <p className="mt-2 text-sm text-olive/75">
          Возможно, ссылка устарела или страница была удалена.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            На главную
          </Link>
          <Link
            href="/search?direction=housing"
            className="inline-flex rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
          >
            В каталог
          </Link>
        </div>
      </section>
    </div>
  );
}
