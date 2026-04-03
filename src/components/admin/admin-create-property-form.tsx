// Form component for creating a new property from admin panel.
"use client";

import { useRef, useState } from "react";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type Props = {
  users: User[];
  action: (formData: FormData) => Promise<void>;
};

const PROPERTY_TYPES = [
  { value: "hotel", label: "Гостиница" },
  { value: "guesthouse", label: "Гостевой дом" },
  { value: "apartment", label: "Квартира / Апартаменты" },
  { value: "cottage", label: "Коттедж / Дом" },
  { value: "hostel", label: "Хостел" },
  { value: "camp", label: "Турбаза / Кемпинг" },
  { value: "sanatorium", label: "Санаторий" },
  { value: "villa", label: "Вилла" },
];

export function AdminCreatePropertyForm({ users, action }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setSubmitting(true);
    const fd = new FormData(formRef.current);
    await action(fd);
    setSubmitting(false);
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-olive/10 bg-white p-5"
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-olive">Владелец *</span>
        <select
          name="ownerId"
          required
          className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
        >
          <option value="">Выберите пользователя...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName} ({u.phone})
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-olive">Тип объекта</span>
        <select
          name="type"
          className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
        >
          <option value="">Не указан</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-olive">Название (необязательно)</span>
        <input
          type="text"
          name="name"
          placeholder="Например: Гостевой дом «Морской бриз»"
          className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {submitting ? "Создание..." : "Создать объект"}
      </button>
    </form>
  );
}
