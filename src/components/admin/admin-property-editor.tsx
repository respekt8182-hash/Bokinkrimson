// Admin property editor component with inline editing.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, UserCheck } from "lucide-react";
import { AdminDeleteDraftButton } from "@/components/admin/admin-delete-draft-button";

type PropertyData = {
  id: string;
  ownerId: string;
  name: string | null;
  type: string | null;
  status: string;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  description: string | null;
  phone: string | null;
  contactEmail: string | null;
  contactPersonName: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  checkInFrom: string | null;
  checkOutUntil: string | null;
  childrenAllowed: boolean | null;
  petsPolicy: string | null;
  smokingPolicy: string | null;
  parkingInfo: string | null;
  mealOptions: string | null;
  seaDistance: string | null;
  moderationNotes: string | null;
  latitude: number | null;
  longitude: number | null;
};

type User = { id: string; firstName: string; lastName: string; phone: string };
type Location = { id: string; name: string };

type Props = {
  property: PropertyData;
  users: User[];
  locations: Location[];
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

const PROPERTY_TYPES = [
  { value: "hotel", label: "Гостиница" },
  { value: "guesthouse", label: "Гостевой дом" },
  { value: "apartment", label: "Квартира / Апартаменты" },
  { value: "cottage", label: "Коттедж / Дом" },
  { value: "hostel", label: "Хостел" },
  { value: "camp", label: "Турбаза / Кемпинг" },
  { value: "sanatorium", label: "Санаторий" },
  { value: "villa", label: "Р’РёР»Р»Р°" },
];

export function AdminPropertyEditor({ property, users, locations }: Props) {
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
      } else if (["latitude", "longitude"].includes(key)) {
        body[key] = Number(v) || null;
      } else if (key === "childrenAllowed") {
        body[key] = v === "true";
      } else {
        body[key] = v;
      }
    }

    if (!fd.has("childrenAllowed")) body.childrenAllowed = null;

    try {
      const res = await fetch(`/api/admin/properties/${property.id}`, {
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
          Р’Р»Р°РґРµР»РµС†
        </h2>
        <Field label="Назначить владельца">
          <select name="ownerId" defaultValue={property.ownerId} className={select}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.phone})
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Основная информация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название">
            <input type="text" name="name" defaultValue={property.name ?? ""} className={input} />
          </Field>
          <Field label="Тип объекта">
            <select name="type" defaultValue={property.type ?? ""} className={select}>
              <option value="">Не указан</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Статус">
            <select name="status" defaultValue={property.status} className={select}>
              <option value="DRAFT">Черновик</option>
              <option value="PENDING_MODERATION">На модерации</option>
              <option value="PUBLISHED">Опубликован</option>
              <option value="REJECTED">Отклонён</option>
            </select>
          </Field>
          <Field label="Расстояние до моря">
            <input type="text" name="seaDistance" defaultValue={property.seaDistance ?? ""} className={input} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Локация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Локация">
            <select name="locationId" defaultValue={property.locationId ?? ""} className={select}>
              <option value="">Не указана</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Адрес">
            <input type="text" name="address" defaultValue={property.address ?? ""} className={input} />
          </Field>
          <Field label="Широта">
            <input type="text" name="latitude" defaultValue={property.latitude ?? ""} className={input} />
          </Field>
          <Field label="Долгота">
            <input type="text" name="longitude" defaultValue={property.longitude ?? ""} className={input} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Описание</h2>
        <Field label="Описание">
          <textarea
            name="description"
            defaultValue={property.description ?? ""}
            rows={6}
            className={input}
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Контакты</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Телефон">
            <input type="text" name="phone" defaultValue={property.phone ?? ""} className={input} />
          </Field>
          <Field label="Email">
            <input type="email" name="contactEmail" defaultValue={property.contactEmail ?? ""} className={input} />
          </Field>
          <Field label="Контактное лицо">
            <input type="text" name="contactPersonName" defaultValue={property.contactPersonName ?? ""} className={input} />
          </Field>
          <Field label="Сайт">
            <input type="text" name="websiteUrl" defaultValue={property.websiteUrl ?? ""} className={input} />
          </Field>
          <Field label="WhatsApp">
            <input type="text" name="whatsappUrl" defaultValue={property.whatsappUrl ?? ""} className={input} />
          </Field>
          <Field label="Telegram">
            <input type="text" name="telegramUrl" defaultValue={property.telegramUrl ?? ""} className={input} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Правила и услуги</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Заезд с">
            <input type="time" name="checkInFrom" defaultValue={property.checkInFrom ?? ""} className={input} />
          </Field>
          <Field label="Выезд до">
            <input type="time" name="checkOutUntil" defaultValue={property.checkOutUntil ?? ""} className={input} />
          </Field>
          <Field label="Р”РµС‚Рё">
            <select name="childrenAllowed" defaultValue={property.childrenAllowed === null ? "" : String(property.childrenAllowed)} className={select}>
              <option value="">Не указано</option>
              <option value="true">Разрешены</option>
              <option value="false">Не разрешены</option>
            </select>
          </Field>
          <Field label="Животные">
            <select name="petsPolicy" defaultValue={property.petsPolicy ?? ""} className={select}>
              <option value="">Не указано</option>
              <option value="FORBIDDEN">Запрещены</option>
              <option value="ON_REQUEST">По запросу</option>
              <option value="ALLOWED">Разрешены</option>
            </select>
          </Field>
          <Field label="Курение">
            <select name="smokingPolicy" defaultValue={property.smokingPolicy ?? ""} className={select}>
              <option value="">Не указано</option>
              <option value="FORBIDDEN">Запрещено</option>
              <option value="ON_REQUEST">По запросу</option>
              <option value="ALLOWED">Разрешено</option>
            </select>
          </Field>
          <Field label="Парковка">
            <input type="text" name="parkingInfo" defaultValue={property.parkingInfo ?? ""} className={input} />
          </Field>
          <Field label="Питание">
            <input type="text" name="mealOptions" defaultValue={property.mealOptions ?? ""} className={input} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-olive/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-olive">Заметки модерации</h2>
        <Field label="Комментарий администратора">
          <textarea
            name="moderationNotes"
            defaultValue={property.moderationNotes ?? ""}
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
        {property.status === "DRAFT" ? (
          <AdminDeleteDraftButton
            endpoint={`/api/admin/properties/${property.id}`}
            draftLabel="Черновик объекта"
            entityName={property.name ?? "Объект без названия"}
            redirectTo="/admin/objects"
            buttonClassName="border border-red-200 bg-red-50 px-6 py-3 text-red-700 hover:bg-red-100 hover:text-red-800"
          />
        ) : null}
      </div>
    </form>
  );
}
