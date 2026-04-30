"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedPropertyDocument } from "@/lib/property-documents";
import type { SerializedProperty } from "@/lib/properties";

type ObjectContractsReportsPageProps = {
  initialProperty: SerializedProperty;
  initialDocuments: SerializedPropertyDocument[];
  displayPropertyNumber: number;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === "string" && body.error.trim().length > 0) {
      return body.error;
    }
  } catch {
    // Ignore parse error.
  }

  return fallback;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${bytes} Б`;
}

export function ObjectContractsReportsPage({
  initialProperty,
  initialDocuments,
  displayPropertyNumber,
}: ObjectContractsReportsPageProps) {
  const initialRegistryNumber = (initialProperty.registryNumber ?? "").trim();
  const [registryNumber, setRegistryNumber] = useState(initialRegistryNumber);
  const [savedRegistryNumber, setSavedRegistryNumber] = useState(initialRegistryNumber);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentType, setDocumentType] = useState("CONTRACT");
  const [documentTitle, setDocumentTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSavingRegistry, setIsSavingRegistry] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const saveRegistry = useCallback(
    async (nextRegistryNumber: string, options?: { silentValidation?: boolean }) => {
      const normalizedRegistryNumber = nextRegistryNumber.trim();
      const silentValidation = options?.silentValidation ?? false;

      if (normalizedRegistryNumber === savedRegistryNumber) {
        return;
      }

      if (!normalizedRegistryNumber) {
        if (!silentValidation) {
          setError("Укажите номер записи в реестре КСР");
          setSuccess("");
        }
        return;
      }

      if (normalizedRegistryNumber.length < 3) {
        if (!silentValidation) {
          setError("Номер записи в реестре слишком короткий");
          setSuccess("");
        }
        return;
      }

      setIsSavingRegistry(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(`/api/properties/${initialProperty.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: 7,
            data: {
              classificationApplicable: true,
              starRating: null,
              registryNumber: normalizedRegistryNumber,
              selfAssessmentPassed: null,
            },
          }),
        });

        if (!response.ok) {
          setError(await readErrorMessage(response, "Не удалось сохранить данные КСР"));
          return;
        }

        setSavedRegistryNumber(normalizedRegistryNumber);
        setRegistryNumber(normalizedRegistryNumber);
        setSuccess("Данные КСР сохранены");
      } finally {
        setIsSavingRegistry(false);
      }
    },
    [initialProperty.id, savedRegistryNumber],
  );

  useEffect(() => {
    const normalizedRegistryNumber = registryNumber.trim();
    if (
      !normalizedRegistryNumber ||
      normalizedRegistryNumber.length < 3 ||
      normalizedRegistryNumber === savedRegistryNumber
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveRegistry(normalizedRegistryNumber, { silentValidation: true });
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [registryNumber, savedRegistryNumber, saveRegistry]);

  async function uploadDocument() {
    if (!uploadFile) {
      setError("Выберите файл документа");
      setSuccess("");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("type", documentType);
      formData.append("title", documentTitle.trim());

      const response = await fetch(`/api/properties/${initialProperty.id}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setError(await readErrorMessage(response, "Не удалось загрузить документ"));
        return;
      }

      const body = (await response.json()) as { items: SerializedPropertyDocument[] };
      setDocuments(body.items ?? []);
      setDocumentTitle("");
      setUploadFile(null);
      setSuccess("Документ загружен");
    } finally {
      setIsUploading(false);
    }
  }

  async function removeDocument(documentId: string) {
    setDeletingDocumentId(documentId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/properties/${initialProperty.id}/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await readErrorMessage(response, "Не удалось удалить документ"));
        return;
      }

      setDocuments((previous) => previous.filter((item) => item.id !== documentId));
      setSuccess("Документ удален");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-cream p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-olive/60">
              ID объекта: {displayPropertyNumber}
            </p>
            <h1 className="text-3xl text-olive">Договоры и отчеты</h1>
          </div>
          <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold uppercase text-olive">
            {initialProperty.statusLabel}
          </span>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">Реестр КСР</h2>
        <div className="rounded-xl border border-olive/15 bg-cream/35 p-4 text-sm text-olive/80">
          <p className="font-semibold text-olive">
            Номер записи в реестре КСР обязателен для средств размещения.
          </p>
          <p className="mt-2">
            Это касается гостиниц и гостиничных форматов, санаториев, баз отдыха, кемпингов,
            глэмпингов и гостевых домов в регионах эксперимента. Номер используется для проверки
            классификации и прохождения модерации объявления.
          </p>
          <p className="mt-2">
            Если объект является жилым помещением и не используется для услуг средства размещения,
            номер может быть неприменим.
          </p>
          <a
            href="https://tourism.fsa.gov.ru/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-terra hover:underline"
          >
            Перейти в реестр КСР
          </a>
        </div>
        <Input
          value={registryNumber}
          onChange={(event) => setRegistryNumber(event.target.value)}
          onBlur={() => {
            const normalizedRegistryNumber = registryNumber.trim();
            if (
              normalizedRegistryNumber.length >= 3 &&
              normalizedRegistryNumber !== savedRegistryNumber
            ) {
              void saveRegistry(normalizedRegistryNumber, { silentValidation: true });
            }
          }}
          placeholder="Номер записи в реестре"
        />
        {isSavingRegistry ? (
          <p className="text-xs text-olive/65">Сохраняем...</p>
        ) : (
          <p className="text-xs text-olive/65">Сохраняется автоматически после заполнения поля.</p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-olive/10 bg-white p-4">
        <h2 className="text-xl text-olive">Документы и отчеты</h2>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
          >
            <option value="CONTRACT">Договор</option>
            <option value="REPORT">Отчет</option>
            <option value="OTHER">Другое</option>
          </select>
          <Input
            value={documentTitle}
            onChange={(event) => setDocumentTitle(event.target.value)}
            placeholder="Название документа"
          />
          <input
            type="file"
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2 text-sm text-olive"
          />
        </div>
        <div>
          <Button onClick={() => void uploadDocument()} disabled={isUploading}>
            {isUploading ? "Загрузка..." : "Добавить документ"}
          </Button>
        </div>

        {documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-olive/30 p-3 text-sm text-olive/70">
            Документы еще не добавлены.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <article
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-olive/15 bg-cream/35 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-olive">{document.title}</p>
                  <p className="text-xs text-olive/65">
                    {document.fileName} • {formatFileSize(document.fileSize)} •{" "}
                    {new Date(document.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-olive/25 px-3 py-1.5 text-xs font-semibold text-olive hover:bg-sand/50"
                  >
                    Открыть
                  </a>
                  <Button
                    variant="ghost"
                    onClick={() => void removeDocument(document.id)}
                    disabled={deletingDocumentId === document.id}
                    className="border border-terra/45 text-terra hover:bg-terra/10 hover:text-terra"
                  >
                    {deletingDocumentId === document.id ? "Удаление..." : "Удалить"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl bg-sage/20 px-3 py-2 text-sm text-olive">{success}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4">
        <Link
          href={`/dashboard/objects/${initialProperty.id}/rules`}
          className="text-sm font-semibold text-terra hover:underline"
        >
          Назад
        </Link>
        <Link
          href={`/dashboard/objects/${initialProperty.id}/room-categories`}
          className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Далее
        </Link>
      </div>
    </div>
  );
}
