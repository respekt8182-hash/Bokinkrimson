"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { Camera, KeyRound, Save, Trash2 } from "lucide-react";
import {
  AdminAvatar,
  AdminButton,
  AdminErrorState,
  AdminLoadingState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  adminInputClass,
} from "@/components/admin/admin-ui";

type AdminProfile = {
  id: string;
  login: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  roleLabel: string;
  authProvider: "env" | "database";
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  editable: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "Нет данных";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Нет данных";
  }
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/profile", { cache: "no-store" });
      const body = (await response.json()) as { item?: AdminProfile; error?: string };

      if (!response.ok || !body.item) {
        throw new Error(body.error ?? "Не удалось загрузить профиль");
      }

      setProfile(body.item);
      setDisplayName(body.item.displayName);
      setEmail(body.item.email ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить профиль");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const body = (await response.json()) as {
        item?: AdminProfile;
        message?: string;
        error?: string;
      };

      if (!response.ok || !body.item) {
        throw new Error(body.error ?? "Не удалось сохранить профиль");
      }

      setProfile(body.item);
      setMessage(body.message ?? "Профиль сохранён.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await response.json()) as {
        item?: AdminProfile;
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Не удалось изменить пароль");
      }

      if (body.item) {
        setProfile(body.item);
      }
      setCurrentPassword("");
      setNewPassword("");
      setMessage(body.message ?? "Пароль изменён.");
    } catch (passwordError) {
      setError(
        passwordError instanceof Error ? passwordError.message : "Не удалось изменить пароль",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setAvatarSaving(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as {
        item?: { avatarUrl: string | null };
        error?: string;
      };

      if (!response.ok || !body.item) {
        throw new Error(body.error ?? "Не удалось загрузить аватар");
      }

      setProfile((current) =>
        current ? { ...current, avatarUrl: body.item?.avatarUrl ?? null } : current,
      );
      setMessage("Аватар обновлён.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Не удалось загрузить аватар");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function deleteAvatar() {
    setAvatarSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/profile/avatar", { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Не удалось удалить аватар");
      }

      setProfile((current) => (current ? { ...current, avatarUrl: null } : current));
      setMessage("Аватар удалён.");
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : "Не удалось удалить аватар");
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading) {
    return <AdminLoadingState label="Загружаем профиль администратора..." />;
  }

  if (!profile) {
    return <AdminErrorState description={error || "Профиль администратора недоступен."} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Профиль администратора"
        description="Текущий административный аккаунт, аватар и пароль."
      />

      {message ? <AdminNotice tone="success">{message}</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {!profile.editable ? (
        <AdminNotice tone="info">
          Главный администратор управляется настройками проекта. В этом профиле нельзя менять
          email, аватар или пароль.
        </AdminNotice>
      ) : null}

      <section className={profile.editable ? "grid gap-6 xl:grid-cols-[0.8fr_1.2fr]" : "max-w-xl"}>
        <AdminPanel title="Аккаунт" description="Кто сейчас вошёл в админ-панель.">
          <div className="flex items-start gap-4">
            <AdminAvatar src={profile.avatarUrl} name={profile.displayName} className="h-20 w-20" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-[var(--admin-text)]">
                {profile.displayName}
              </p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">{profile.roleLabel}</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">{profile.login}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 rounded-xl bg-[var(--admin-muted-surface)] px-3 py-2">
              <dt className="text-[var(--admin-muted)]">Тип</dt>
              <dd className="font-semibold text-[var(--admin-text)]">
                {profile.authProvider === "database" ? "DB account" : "Env fallback"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 rounded-xl bg-[var(--admin-muted-surface)] px-3 py-2">
              <dt className="text-[var(--admin-muted)]">Создан</dt>
              <dd className="font-semibold text-[var(--admin-text)]">
                {formatDate(profile.createdAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 rounded-xl bg-[var(--admin-muted-surface)] px-3 py-2">
              <dt className="text-[var(--admin-muted)]">Последний вход</dt>
              <dd className="font-semibold text-[var(--admin-text)]">
                {formatDate(profile.lastLoginAt)}
              </dd>
            </div>
          </dl>
        </AdminPanel>

        {profile.editable ? (
          <AdminPanel title="Данные профиля" description="Имя и контактный email администратора.">
            <form onSubmit={saveProfile} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--admin-text)]">Имя</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className={adminInputClass}
                  disabled={saving}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--admin-text)]">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={adminInputClass}
                  disabled={saving}
                />
              </label>
              <AdminButton type="submit" variant="primary" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Сохраняем..." : "Сохранить"}
              </AdminButton>
            </form>
          </AdminPanel>
        ) : null}
      </section>

      {profile.editable ? (
      <section className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Аватар" description="PNG, JPEG, WEBP, HEIC или HEIF до 5 МБ.">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--admin-text)] shadow-[var(--admin-shadow-xs)] transition hover:border-[var(--admin-primary-border)] hover:text-[var(--admin-primary)]">
              <Camera className="h-4 w-4" />
              {avatarSaving ? "Загрузка..." : "Загрузить"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={uploadAvatar}
                disabled={avatarSaving}
              />
            </label>
            <AdminButton
              variant="danger"
              onClick={deleteAvatar}
              disabled={avatarSaving || !profile.avatarUrl}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </AdminButton>
          </div>
        </AdminPanel>

        <AdminPanel title="Пароль" description="Смена пароля доступна только DB-админу.">
          <form onSubmit={changePassword} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Текущий пароль</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={adminInputClass}
                disabled={saving}
                autoComplete="current-password"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Новый пароль</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={adminInputClass}
                disabled={saving}
                autoComplete="new-password"
              />
            </label>
            <AdminButton type="submit" disabled={saving} variant="secondary">
              <KeyRound className="h-4 w-4" />
              Изменить пароль
            </AdminButton>
          </form>
        </AdminPanel>
      </section>
      ) : null}
    </div>
  );
}
