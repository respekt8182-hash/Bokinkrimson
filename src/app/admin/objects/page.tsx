// Next.js page for route /admin/objects.
import Link from "next/link";
import { PropertyStatus } from "@prisma/client";
import { AdminRestorePropertyAction } from "@/components/admin/admin-restore-property-action";
import { db } from "@/lib/db";
import { rankByTrigram } from "@/lib/fuzzy";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getPropertyWorkflowStatusLabel } from "@/lib/properties";

type AdminObjectsPageProps = {
  searchParams: Promise<{
    locationId?: string;
    q?: string;
  }>;
};

export default async function AdminObjectsPage({ searchParams }: AdminObjectsPageProps) {
  const filters = await searchParams;
  const now = new Date();

  const locationDirectory = await getLocationDirectoryItems();
  const selectedLocationId = filters.locationId?.trim() ?? "";
  const query = filters.q?.trim() ?? "";

  const rows = await db.property.findMany({
    where: {
      status: PropertyStatus.PUBLISHED,
      ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
      OR: [{ ownerDeletedAt: null }, { ownerDeletionExpiresAt: { gt: now } }],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      rooms: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const items =
    query.length >= 2
      ? rankByTrigram(
          query,
          rows,
          (item) => [
            item.name,
            item.locationName,
            item.address,
            item.description,
            item.type,
            `${item.owner.firstName} ${item.owner.lastName}`,
            item.owner.email,
          ],
          { limit: rows.length, minScore: 0.08 },
        )
      : rows;

  const locationBuckets = items.reduce(
    (accumulator, item) => {
      if (!item.locationId || !item.locationName) {
        return accumulator;
      }

      const existing = accumulator.get(item.locationId);
      if (existing) {
        existing.count += 1;
      } else {
        accumulator.set(item.locationId, { id: item.locationId, name: item.locationName, count: 1 });
      }
      return accumulator;
    },
    new Map<string, { id: string; name: string; count: number }>(),
  );

  const sortedLocationBuckets = Array.from(locationBuckets.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.name.localeCompare(right.name, "ru");
  });

  const buildFilterLink = (locationId: string): string => {
    const params = new URLSearchParams();
    if (locationId) params.set("locationId", locationId);
    if (query) params.set("q", query);
    const search = params.toString();
    return search ? `/admin/objects?${search}` : "/admin/objects";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-olive">Опубликованные объекты</h1>
      <p className="text-sm text-olive/70">
        В этом разделе отображаются только объекты со статусом «Опубликован».
      </p>

      <form className="grid gap-3 rounded-2xl border border-olive/10 bg-white p-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Локация</span>
          <select
            name="locationId"
            defaultValue={selectedLocationId}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            <option value="">Все локации</option>
            {locationDirectory.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-olive">Поиск (триграммы)</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Название, локация, владелец..."
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          />
        </label>
        <button
          type="submit"
          className="md:col-span-2 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Применить фильтры
        </button>
      </form>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-olive/70">
          Подкаталоги по городам
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={buildFilterLink("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !selectedLocationId ? "bg-primary text-white" : "bg-cream text-olive hover:bg-sage/35"
            }`}
          >
            Все ({items.length})
          </Link>
          {sortedLocationBuckets.map((bucket) => (
            <Link
              key={bucket.id}
              href={buildFilterLink(bucket.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedLocationId === bucket.id
                  ? "bg-primary text-white"
                  : "bg-cream text-olive hover:bg-sage/35"
              }`}
            >
              {bucket.name} ({bucket.count})
            </Link>
          ))}
        </div>
      </section>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/70">
          Объекты не найдены.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg text-olive">{item.name ?? "Объект без названия"}</h2>
                  <p className="text-xs text-olive/60">ID: {item.id}</p>
                </div>
                <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold text-olive">
                  {getPropertyWorkflowStatusLabel(
                    item.status,
                    item.moderationNotes,
                    item.pendingEditStatus,
                  )}
                </span>
              </div>

              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Владелец</dt>
                  <dd className="font-medium text-olive">
                    {item.owner.firstName} {item.owner.lastName}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Email</dt>
                  <dd className="font-medium text-olive">{item.owner.email}</dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Локация</dt>
                  <dd className="font-medium text-olive">{item.locationName ?? "Не указана"}</dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Номеров</dt>
                  <dd className="font-medium text-olive">{item.rooms.length}</dd>
                </div>
              </dl>

              <p className="mt-3 text-sm text-olive/75">
                Рейтинг: {Number(item.avgRating).toFixed(1)} ({item.reviewsCount} отзывов)
              </p>

              {item.ownerDeletedAt ? (
                <div className="mt-3 space-y-2 rounded-xl bg-terra/10 px-3 py-2 text-sm text-olive/85">
                  <p>
                    Владелец удалил объект из кабинета:{" "}
                    <span className="font-semibold text-olive">
                      {new Date(item.ownerDeletedAt).toLocaleString("ru-RU")}
                    </span>
                    .
                  </p>
                  <p>
                    Восстановление доступно до{" "}
                    <span className="font-semibold text-olive">
                      {item.ownerDeletionExpiresAt
                        ? new Date(item.ownerDeletionExpiresAt).toLocaleString("ru-RU")
                        : "истечения срока"}
                    </span>
                    .
                  </p>
                  <AdminRestorePropertyAction propertyId={item.id} />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-olive/60">
                  Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                </p>
                <Link
                  href={`/admin/moderation/${item.id}`}
                  className="rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive hover:bg-cream"
                >
                  Открыть
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
