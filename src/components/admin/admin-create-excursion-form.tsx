// Form component for creating a new excursion from admin panel.
"use client";

import { useRef, useState } from "react";
import { Compass, Map } from "lucide-react";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type Props = {
  users: User[];
  action: (formData: FormData) => Promise<void>;
  errorMessage?: string | null;
};

export function AdminCreateExcursionForm({ users, action, errorMessage }: Props) {
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
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
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
        <span className="text-sm font-medium text-olive">Тип предложения</span>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-olive/15 p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="offerType"
              value="EXCURSION"
              defaultChecked
              className="accent-primary"
            />
            <Compass className="h-4 w-4 text-olive/60" />
            <span className="text-sm font-medium text-olive">Экскурсия</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-olive/15 p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="offerType" value="TOUR" className="accent-primary" />
            <Map className="h-4 w-4 text-olive/60" />
            <span className="text-sm font-medium text-olive">Тур</span>
          </label>
        </div>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-olive">Название (необязательно)</span>
        <input
          type="text"
          name="title"
          placeholder="Например: Обзорная экскурсия по Севастополю"
          className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {submitting ? "Создание..." : "Создать экскурсию"}
      </button>
    </form>
  );
}
