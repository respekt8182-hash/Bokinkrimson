// Admin excursion editor component with inline editing.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, UserCheck } from "lucide-react";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";

type ExcursionData = {
  id: string;
  ownerId: string;
  offerType: string;
  title: string | null;
  description: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  mainLocationId: string | null;
  categoryId: string | null;
  districtId: string | null;
  locationName: string | null;
  address: string | null;
  startPoint: string | null;
  finishPoint: string | null;
  durationMinutes: number | null;
  durationDays: number | null;
  durationNights: number | null;
  format: string | null;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceType: string;
  difficulty: string | null;
  isKidFriendly: boolean | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
  contactPhone2: string | null;
  contactEmail: string | null;
  status: string;
  moderationNotes: string | null;
};

type User = { id: string; firstName: string; phone: string };
type Ref = { id: string; name: string };

type Props = {
  excursion: ExcursionData;
  users: User[];
  locations: Ref[];
  categories: Ref[];
  districts: Ref[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-olive">{label}</span>
      {children}
    </label>
  );
}

const input =
  "w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const select = input;

export function AdminExcursionEditor({
  excursion,
  users,
  locations,
  categories,
  districts,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};

    for (const [key, val] of fd.entries()) {
      const v = typeof val === "string" ? val.trim() : val;
      if (v === "") {
        body[key] = null;
      } else if (
        [
          "durationMinutes",
          "durationDays",
          "durationNights",
          "groupSizeMin",
          "groupSizeMax",
        ].includes(key)
      ) {
        body[key] = Number(v) || null;
      } else if (["priceFrom", "priceTo"].includes(key)) {
        body[key] = Number(v) || null;
      } else if (key === "isKidFriendly") {
        body[key] = v === "true";
      } else {
        body[key] = v;
      }
    }

    if (!fd.has("isKidFriendly")) body.isKidFriendly = false;

    try {
      const res = await fetch(`/api/admin/excursions/${excursion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "err", text: data.error ?? "Ошибка сохранения" });
      } else {
        setMessage({ type: "ok", text: "Сохранено" });
        router.refresh();
      }
    } catch {
      setMessage({ type: "err", text: "Ошибка сети" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-1 ring-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-olive">
          <UserCheck className="h-5 w-5 text-primary" />
          Владелец
        </h2>
        <Field label="Назначить владельца">
          <select name="ownerId" defaultValue={excursion.ownerId} className={select}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} ({u.phone})
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Основная информация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название">
            <input
              type="text"
              name="title"
              defaultValue={excursion.title ?? ""}
              className={input}
            />
          </Field>
          <Field label="Тип">
            <select name="offerType" defaultValue={excursion.offerType} className={select}>
              <option value="EXCURSION">Экскурсия</option>
              <option value="TOUR">Тур</option>
            </select>
          </Field>
          <Field label="Статус">
            <select name="status" defaultValue={excursion.status} className={select}>
              <option value="DRAFT">Черновик</option>
              <option value="PENDING_MODERATION">На модерации</option>
              <option value="PUBLISHED">Опубликована</option>
              <option value="NEEDS_FIX">Нужна доработка</option>
              <option value="REJECTED">Отклонена</option>
            </select>
          </Field>
          <Field label="Формат">
            <select name="format" defaultValue={excursion.format ?? ""} className={select}>
              <option value="">Не указан</option>
              <option value="GROUP">Групповая</option>
              <option value="PRIVATE">Приватная</option>
              <option value="INDIVIDUAL">Индивидуальная</option>
              <option value="VIP">VIP</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Локация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Основная локация">
            <select
              name="mainLocationId"
              defaultValue={excursion.mainLocationId ?? ""}
              className={select}
            >
              <option value="">Не указана</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Район">
            <select name="districtId" defaultValue={excursion.districtId ?? ""} className={select}>
              <option value="">Не указан</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Категория">
            <select name="categoryId" defaultValue={excursion.categoryId ?? ""} className={select}>
              <option value="">Не указана</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Адрес">
            <input
              type="text"
              name="address"
              defaultValue={excursion.address ?? ""}
              className={input}
            />
          </Field>
          <Field label="Точка старта">
            <input
              type="text"
              name="startPoint"
              defaultValue={excursion.startPoint ?? ""}
              className={input}
            />
          </Field>
          <Field label="Точка финиша">
            <input
              type="text"
              name="finishPoint"
              defaultValue={excursion.finishPoint ?? ""}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Описание</h2>
        <div className="space-y-4">
          <Field label="Краткое описание">
            <textarea
              name="shortDescription"
              defaultValue={excursion.shortDescription ?? ""}
              rows={2}
              className={input}
            />
          </Field>
          <Field label="Описание">
            <textarea
              name="description"
              defaultValue={excursion.description ?? ""}
              rows={4}
              className={input}
            />
          </Field>
          <Field label="Полное описание">
            <textarea
              name="fullDescription"
              defaultValue={excursion.fullDescription ?? ""}
              rows={6}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Длительность и группа</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Длительность (мин)">
            <input
              type="number"
              name="durationMinutes"
              defaultValue={excursion.durationMinutes ?? ""}
              className={input}
            />
          </Field>
          <Field label="Дней (для туров)">
            <input
              type="number"
              name="durationDays"
              defaultValue={excursion.durationDays ?? ""}
              className={input}
            />
          </Field>
          <Field label="Ночей (для туров)">
            <input
              type="number"
              name="durationNights"
              defaultValue={excursion.durationNights ?? ""}
              className={input}
            />
          </Field>
          <Field label="Мин. размер группы">
            <input
              type="number"
              name="groupSizeMin"
              defaultValue={excursion.groupSizeMin ?? ""}
              className={input}
            />
          </Field>
          <Field label="Макс. размер группы">
            <input
              type="number"
              name="groupSizeMax"
              defaultValue={excursion.groupSizeMax ?? ""}
              className={input}
            />
          </Field>
          <Field label="Сложность">
            <select name="difficulty" defaultValue={excursion.difficulty ?? ""} className={select}>
              <option value="">Не указана</option>
              <option value="EASY">Лёгкая</option>
              <option value="MEDIUM">Средняя</option>
              <option value="HARD">Сложная</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Цены</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Цена от (₽)">
            <input
              type="number"
              name="priceFrom"
              defaultValue={excursion.priceFrom ?? ""}
              className={input}
            />
          </Field>
          <Field label="Цена до (₽)">
            <input
              type="number"
              name="priceTo"
              defaultValue={excursion.priceTo ?? ""}
              className={input}
            />
          </Field>
          <Field label="Тип цены">
            <select name="priceType" defaultValue={excursion.priceType} className={select}>
              <option value="PER_PERSON">За человека</option>
              <option value="PER_GROUP">За группу</option>
              <option value="PER_CAR">За машину</option>
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isKidFriendly"
              value="true"
              defaultChecked={excursion.isKidFriendly === true}
              className="accent-primary"
            />
            <span className="text-sm text-olive">Подходит для детей</span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Контакты</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Имя">
            <input
              type="text"
              name="contactFirstName"
              defaultValue={excursion.contactFirstName ?? ""}
              className={input}
            />
          </Field>
          <Field label="Фамилия">
            <input
              type="text"
              name="contactLastName"
              defaultValue={excursion.contactLastName ?? ""}
              className={input}
            />
          </Field>
          <Field label="Телефон">
            <input
              type="text"
              name="contactPhone"
              defaultValue={excursion.contactPhone ?? ""}
              className={input}
            />
          </Field>
          <Field label="Телефон 2">
            <input
              type="text"
              name="contactPhone2"
              defaultValue={excursion.contactPhone2 ?? ""}
              className={input}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              name="contactEmail"
              defaultValue={excursion.contactEmail ?? ""}
              className={input}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Заметки модерации</h2>
        <Field label="Комментарий администратора">
          <textarea
            name="moderationNotes"
            defaultValue={excursion.moderationNotes ?? ""}
            rows={3}
            className={input}
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {excursion.status === "DRAFT" ? (
          <AdminDeleteDraftButton
            endpoint={`/api/admin/excursions/${excursion.id}`}
            draftLabel="Черновик экскурсии"
            entityName={excursion.title ?? "Экскурсия без названия"}
            redirectTo="/admin/excursions"
            buttonClassName="border border-red-200 bg-red-50 px-6 py-3 text-red-700 hover:bg-red-100 hover:text-red-800"
          />
        ) : null}
      </div>
    </form>
  );
}
