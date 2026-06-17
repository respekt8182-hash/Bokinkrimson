"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Plus, RefreshCw, Save } from "lucide-react";
import {
  AdminAvatar,
  AdminButton,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
  adminInputClass,
} from "@/components/admin/admin-ui";

type AdminAccountItem = {
  id: string;
  login: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  status: "ACTIVE" | "DISABLED";
  authProvider: "env" | "database";
  createdAt: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  immutable: boolean;
  password?: string;
};

type AdminAccountsResponse = {
  schemaReady: boolean;
  items: AdminAccountItem[];
  roles: Record<string, string>;
  message?: string;
  error?: string;
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

function getEditableRoleEntries(roles: Record<string, string>): Array<[string, string]> {
  return Object.entries(roles).filter(([role]) => role !== "SUPER_ADMIN");
}

export default function AdminAccountsPage() {
  const [items, setItems] = useState<AdminAccountItem[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [schemaReady, setSchemaReady] = useState(true);
  const [schemaMessage, setSchemaMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    login: "",
    email: "",
    displayName: "",
    role: "ADMIN",
    password: "",
  });
  const editableRoleEntries = getEditableRoleEntries(roles);

  async function loadAdmins() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/admins", { cache: "no-store" });
      const body = (await response.json()) as AdminAccountsResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Не удалось загрузить администраторов");
      }

      setItems(body.items);
      setRoles(body.roles);
      setSchemaReady(body.schemaReady);
      setSchemaMessage(body.message ?? "");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Не удалось загрузить администраторов",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdmins();
  }, []);

  function updateItem(id: string, patch: Partial<AdminAccountItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setTemporaryPassword("");

    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const body = (await response.json()) as {
        item?: AdminAccountItem;
        temporaryPassword?: string | null;
        error?: string;
      };

      if (!response.ok || !body.item) {
        throw new Error(body.error ?? "Не удалось создать администратора");
      }

      setItems((current) => [body.item!, ...current]);
      setCreateForm({ login: "", email: "", displayName: "", role: "ADMIN", password: "" });
      setTemporaryPassword(body.temporaryPassword ?? "");
      setMessage("Администратор создан.");
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Не удалось создать администратора",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAdmin(item: AdminAccountItem) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/admins/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: item.displayName,
          email: item.email,
          role: item.role,
          status: item.status,
          password: item.password,
        }),
      });
      const body = (await response.json()) as { item?: AdminAccountItem; error?: string };

      if (!response.ok || !body.item) {
        throw new Error(body.error ?? "Не удалось сохранить администратора");
      }

      setItems((current) =>
        current.map((currentItem) => (currentItem.id === item.id ? body.item! : currentItem)),
      );
      setMessage("Администратор сохранён.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Не удалось сохранить администратора",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminLoadingState label="Загружаем администраторов..." />;
  }

  if (error && items.length === 0) {
    return <AdminErrorState description={error} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Администраторы"
        description="Отдельные админ-аккаунты, роли и безопасное отключение доступа."
        actions={
          <AdminButton onClick={() => void loadAdmins()} disabled={saving}>
            <RefreshCw className="h-4 w-4" />
            Обновить
          </AdminButton>
        }
      />

      {schemaReady ? null : <AdminNotice tone="warning">{schemaMessage}</AdminNotice>}
      {temporaryPassword ? (
        <AdminNotice tone="success">
          Временный пароль нового администратора: <strong>{temporaryPassword}</strong>. Он показан
          только сейчас.
        </AdminNotice>
      ) : null}
      {message ? <AdminNotice tone="success">{message}</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminPanel
        title="Создать администратора"
        description="Пароль можно задать вручную или оставить пустым для генерации временного."
      >
        <form onSubmit={createAdmin} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_180px_auto]">
          <input
            value={createForm.login}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, login: event.target.value }))
            }
            className={adminInputClass}
            placeholder="Логин"
            disabled={!schemaReady || saving}
          />
          <input
            value={createForm.displayName}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, displayName: event.target.value }))
            }
            className={adminInputClass}
            placeholder="Имя"
            disabled={!schemaReady || saving}
          />
          <input
            type="email"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, email: event.target.value }))
            }
            className={adminInputClass}
            placeholder="Email"
            disabled={!schemaReady || saving}
          />
          <select
            value={createForm.role}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, role: event.target.value }))
            }
            className={adminInputClass}
            disabled={!schemaReady || saving}
          >
            {editableRoleEntries.map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
          <AdminButton type="submit" variant="primary" disabled={!schemaReady || saving}>
            <Plus className="h-4 w-4" />
            Создать
          </AdminButton>
          <input
            type="password"
            value={createForm.password}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, password: event.target.value }))
            }
            className={adminInputClass}
            placeholder="Пароль, если не нужен временный"
            disabled={!schemaReady || saving}
          />
        </form>
      </AdminPanel>

      <AdminPanel
        title="Список администраторов"
        description="Env-admin нельзя отключить из интерфейса, он остаётся аварийным входом."
      >
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`grid gap-3 rounded-2xl border border-[var(--admin-border)] bg-white p-4 shadow-[var(--admin-shadow-xs)] ${
                  item.immutable
                    ? "xl:grid-cols-[minmax(220px,1fr)_140px_auto]"
                    : "xl:grid-cols-[minmax(220px,1fr)_180px_180px_160px_140px_auto]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AdminAvatar src={item.avatarUrl} name={item.displayName} />
                  <div className="min-w-0">
                    <input
                      value={item.displayName}
                      onChange={(event) => updateItem(item.id, { displayName: event.target.value })}
                      className={adminInputClass}
                      disabled={item.immutable || saving}
                    />
                    <p className="mt-1 truncate text-[12px] text-[var(--admin-muted)]">
                      {item.login}
                    </p>
                  </div>
                </div>
                {!item.immutable ? (
                  <>
                    <input
                      type="email"
                      value={item.email ?? ""}
                      onChange={(event) => updateItem(item.id, { email: event.target.value })}
                      className={adminInputClass}
                      placeholder="Email"
                      disabled={saving}
                    />
                    <select
                      value={item.role}
                      onChange={(event) => updateItem(item.id, { role: event.target.value })}
                      className={adminInputClass}
                      disabled={saving}
                    >
                      {editableRoleEntries.map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                {!item.immutable ? (
                  <select
                    value={item.status}
                    onChange={(event) =>
                      updateItem(item.id, { status: event.target.value as "ACTIVE" | "DISABLED" })
                    }
                    className={adminInputClass}
                    disabled={saving}
                  >
                    <option value="ACTIVE">Активен</option>
                    <option value="DISABLED">Отключён</option>
                  </select>
                ) : null}
                <div className="space-y-2 text-sm">
                  <AdminStatusBadge tone={item.status === "ACTIVE" ? "success" : "danger"}>
                    {item.status === "ACTIVE" ? "Активен" : "Отключён"}
                  </AdminStatusBadge>
                  {!item.immutable ? (
                    <p className="text-[12px] text-[var(--admin-muted)]">
                      Вход: {formatDate(item.lastLoginAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {!item.immutable ? (
                    <AdminButton onClick={() => void saveAdmin(item)} disabled={saving}>
                      <Save className="h-4 w-4" />
                      Сохранить
                    </AdminButton>
                  ) : null}
                </div>
                {!item.immutable ? (
                  <input
                    type="password"
                    value={item.password ?? ""}
                    onChange={(event) => updateItem(item.id, { password: event.target.value })}
                    className={adminInputClass}
                    placeholder="Новый пароль для сброса"
                    disabled={saving}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState description="DB-администраторов пока нет." />
        )}
      </AdminPanel>
    </div>
  );
}
