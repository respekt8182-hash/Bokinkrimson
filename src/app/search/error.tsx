"use client";

// Error boundary UI for route segment /search.
type SearchErrorProps = {
  error: Error;
  reset: () => void;
};

export default function SearchError({ error, reset }: SearchErrorProps) {
  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-8 md:px-6" role="alert" aria-live="assertive">
      <section className="rounded-2xl border border-terra/30 bg-white/95 p-5 text-olive">
        <h2 className="text-xl text-olive">Ошибка загрузки каталога</h2>
        <p className="mt-2 text-sm text-olive/75">
          Не удалось получить данные поиска. Попробуйте снова через несколько секунд.
        </p>
        <p className="mt-2 text-xs text-olive/60">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/88"
        >
          Повторить
        </button>
      </section>
    </div>
  );
}
