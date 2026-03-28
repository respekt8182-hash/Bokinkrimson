// Loading UI for route segment /search.
export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4 px-4 py-5 md:px-6 md:py-7" aria-busy="true" aria-label="Загрузка...">
      <section className="rounded-[26px] border border-olive/10 bg-white/80 p-4 md:p-5">
        <div className="catalog-skeleton h-8 w-64 rounded-lg" />
        <div className="mt-2 catalog-skeleton h-4 w-48 rounded-md" />
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="catalog-skeleton h-[62px] rounded-2xl" />
          <div className="catalog-skeleton h-[62px] rounded-2xl" />
          <div className="catalog-skeleton h-[62px] rounded-2xl" />
        </div>
      </section>

      <section className="space-y-4">
        <article className="rounded-[20px] border border-olive/12 bg-white/95 p-3">
          <div className="grid gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="catalog-skeleton h-[210px] rounded-2xl" />
            <div className="space-y-2">
              <div className="catalog-skeleton h-3 w-20 rounded-md" />
              <div className="catalog-skeleton h-6 w-3/5 rounded-md" />
              <div className="catalog-skeleton h-4 w-2/5 rounded-md" />
              <div className="catalog-skeleton h-5 w-28 rounded-md" />
              <div className="grid gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-2">
                  <div className="catalog-skeleton h-6 w-32 rounded-md" />
                  <div className="catalog-skeleton h-4 w-36 rounded-md" />
                </div>
                <div className="catalog-skeleton h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </article>
        <article className="rounded-[20px] border border-olive/12 bg-white/95 p-3">
          <div className="grid gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="catalog-skeleton h-[210px] rounded-2xl" />
            <div className="space-y-2">
              <div className="catalog-skeleton h-3 w-20 rounded-md" />
              <div className="catalog-skeleton h-6 w-1/2 rounded-md" />
              <div className="catalog-skeleton h-4 w-1/3 rounded-md" />
              <div className="catalog-skeleton h-5 w-24 rounded-md" />
              <div className="grid gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-2">
                  <div className="catalog-skeleton h-6 w-28 rounded-md" />
                  <div className="catalog-skeleton h-4 w-32 rounded-md" />
                </div>
                <div className="catalog-skeleton h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
