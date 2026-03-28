"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { applicationStatusOptions } from "@/lib/constants";
import type { SerializedApplication } from "@/lib/applications";

// Client board for owner-side request management:
// - filtering by entity/status
// - status updates
// - lightweight stats widgets
type ApplicationStatusValue = "NEW" | "IN_PROGRESS" | "CLOSED";
type ApplicationEntityTypeValue = "PROPERTY" | "EXCURSION";

type OwnerApplicationStats = {
  total: number;
  newCount: number;
  inProgressCount: number;
  closedCount: number;
};

type OwnerApplicationsBoardProps = {
  initialItems: SerializedApplication[];
  initialStats: OwnerApplicationStats;
  propertyOptions: Array<{ id: string; name: string }>;
  excursionOptions: Array<{ id: string; name: string }>;
};

function statusBadgeClass(status: ApplicationStatusValue): string {
  if (status === "NEW") {
    return "bg-terra/15 text-terra";
  }

  if (status === "IN_PROGRESS") {
    return "bg-sage/30 text-olive";
  }

  return "bg-primary/15 text-olive";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function computeStats(items: SerializedApplication[]): OwnerApplicationStats {
  return {
    total: items.length,
    newCount: items.filter((item) => item.status === "NEW").length,
    inProgressCount: items.filter((item) => item.status === "IN_PROGRESS").length,
    closedCount: items.filter((item) => item.status === "CLOSED").length,
  };
}

export function OwnerApplicationsBoard({
  initialItems,
  initialStats,
  propertyOptions,
  excursionOptions,
}: OwnerApplicationsBoardProps) {
  const [items, setItems] = useState(initialItems);
  const [stats, setStats] = useState(initialStats);
  const [selectedEntityType, setSelectedEntityType] = useState<ApplicationEntityTypeValue | "">("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedExcursionId, setSelectedExcursionId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatusValue | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const hasFilters = useMemo(
    () => Boolean(selectedEntityType || selectedPropertyId || selectedExcursionId || selectedStatus),
    [selectedEntityType, selectedPropertyId, selectedExcursionId, selectedStatus],
  );

  // Keep filters mutually consistent: selecting one entity type clears the opposite entity selector.
  useEffect(() => {
    if (selectedEntityType === "PROPERTY" && selectedExcursionId) {
      setSelectedExcursionId("");
    }
    if (selectedEntityType === "EXCURSION" && selectedPropertyId) {
      setSelectedPropertyId("");
    }
  }, [selectedEntityType, selectedExcursionId, selectedPropertyId]);

  useEffect(() => {
    async function loadItems() {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedEntityType) {
          params.set("entityType", selectedEntityType);
        }
        if (selectedPropertyId) {
          params.set("propertyId", selectedPropertyId);
        }
        if (selectedExcursionId) {
          params.set("excursionId", selectedExcursionId);
        }
        if (selectedStatus) {
          params.set("status", selectedStatus);
        }

        // Server performs ownership checks and returns only current owner's applications.
        const response = await fetch(`/api/applications?${params.toString()}`);
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          setError(body.error ?? "Не удалось загрузить заявки");
          return;
        }

        const body = (await response.json()) as {
          items: SerializedApplication[];
          stats: OwnerApplicationStats;
        };
        setItems(body.items);
        setStats(body.stats);
      } finally {
        setIsLoading(false);
      }
    }

    void loadItems();
  }, [selectedEntityType, selectedPropertyId, selectedExcursionId, selectedStatus]);

  // Optimistic-like update: replace only changed item; refresh aggregate cards when no filters.
  async function updateStatus(id: string, status: ApplicationStatusValue) {
    setError("");
    setIsUpdatingId(id);
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось изменить статус");
        return;
      }

      const body = (await response.json()) as { item: SerializedApplication };
      const nextItems = items.map((item) => (item.id === id ? body.item : item));
      setItems(nextItems);

      if (!hasFilters) {
        setStats(computeStats(nextItems));
      }
    } finally {
      setIsUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Всего</p>
          <p className="text-xl font-semibold text-olive">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Новые</p>
          <p className="text-xl font-semibold text-olive">{stats.newCount}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">В работе</p>
          <p className="text-xl font-semibold text-olive">{stats.inProgressCount}</p>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2">
          <p className="text-xs text-olive/60">Закрыты</p>
          <p className="text-xl font-semibold text-olive">{stats.closedCount}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-lg text-olive">Фильтры</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-olive">Тип</span>
            <select
              className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
              value={selectedEntityType}
              onChange={(event) => setSelectedEntityType(event.target.value as ApplicationEntityTypeValue | "")}
            >
              <option value="">Все типы</option>
              <option value="PROPERTY">Жилье</option>
              <option value="EXCURSION">Экскурсии</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-olive">Объект</span>
            <select
              className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
              value={selectedPropertyId}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
              disabled={selectedEntityType === "EXCURSION"}
            >
              <option value="">Все объекты</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-olive">Экскурсия</span>
            <select
              className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
              value={selectedExcursionId}
              onChange={(event) => setSelectedExcursionId(event.target.value)}
              disabled={selectedEntityType === "PROPERTY"}
            >
              <option value="">Все экскурсии</option>
              {excursionOptions.map((excursion) => (
                <option key={excursion.id} value={excursion.id}>
                  {excursion.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-olive">Статус</span>
            <select
              className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as ApplicationStatusValue | "")}
            >
              <option value="">Все статусы</option>
              {applicationStatusOptions.map((statusOption) => (
                <option key={statusOption.id} value={statusOption.id}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {isLoading ? <p className="text-sm text-olive/70">Загрузка заявок...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isLoading && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-olive/30 p-4 text-sm text-olive/70">
          Заявок пока нет.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-olive/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg text-olive">{item.entityTitle ?? "Объявление"}</h3>
                  <p className="text-xs text-olive/60">ID заявки: {item.id}</p>
                  <p className="text-xs text-olive/60">Тип: {item.entityTypeLabel}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}
                >
                  {item.statusLabel}
                </span>
              </div>

              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Даты</dt>
                  <dd className="font-medium text-olive">
                    {item.dateFrom} - {item.dateTo}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Гости / размещение</dt>
                  <dd className="font-medium text-olive">
                    {item.guestsCount} /{" "}
                    {item.entityType === "PROPERTY" ? (item.roomTitle ?? "Любой номер") : "Без номера"}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream px-3 py-2">
                  <dt className="text-olive/60">Создана</dt>
                  <dd className="font-medium text-olive">{formatDateTime(item.createdAt)}</dd>
                </div>
              </dl>

              <div className="mt-3 rounded-xl bg-cream/70 p-3 text-sm text-olive/80">
                <p>
                  <span className="font-semibold text-olive">Контакт:</span> {item.contactName}
                </p>
                <p>
                  <span className="font-semibold text-olive">Телефон:</span> {item.contactPhone}
                </p>
                <p>
                  <span className="font-semibold text-olive">Email:</span> {item.contactEmail}
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-olive">Комментарий:</span>{" "}
                  {item.message?.trim() ? item.message : "Без комментария"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant={item.status === "NEW" ? "primary" : "ghost"}
                  disabled={isUpdatingId === item.id}
                  onClick={() => void updateStatus(item.id, "NEW")}
                >
                  Новая
                </Button>
                <Button
                  variant={item.status === "IN_PROGRESS" ? "primary" : "ghost"}
                  disabled={isUpdatingId === item.id}
                  onClick={() => void updateStatus(item.id, "IN_PROGRESS")}
                >
                  В работе
                </Button>
                <Button
                  variant={item.status === "CLOSED" ? "primary" : "ghost"}
                  disabled={isUpdatingId === item.id}
                  onClick={() => void updateStatus(item.id, "CLOSED")}
                >
                  Закрыта
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
