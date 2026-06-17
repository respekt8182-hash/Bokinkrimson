"use client";

import type { PetsPolicy, SmokingPolicy } from "@prisma/client";
import {
  Baby,
  ChevronDown,
  CigaretteOff,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  ExternalLink,
  Moon,
  PawPrint,
  ShieldCheck,
  Sunrise,
  Sunset,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { PropertyRulesExtraFields } from "@/components/objects/property-rules-extra-fields";
import { AppIcon } from "@/components/ui/app-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { petsPolicyOptions, smokingPolicyOptions } from "@/lib/constants";
import type { SerializedProperty } from "@/lib/properties";

type RulesSnapshot = {
  checkInFrom: string;
  checkOutUntil: string;
  childrenAllowed: boolean | null;
  childrenMinAge: number | null;
  petsPolicy: PetsPolicy;
  smokingPolicy: SmokingPolicy;
  quietHoursEnabled: boolean | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  parkingInfo: string | null;
  mealOptions: string | null;
  prepaymentPolicy: string | null;
};

type ObjectRulesPageProps = {
  initialProperty: SerializedProperty;
  displayPropertyNumber: number;
  basePath?: string;
};

const rulesDraftStorageKeyPrefix = "object-rules-draft:";

function getRulesDraftStorageKey(propertyId: string): string {
  return `${rulesDraftStorageKeyPrefix}${propertyId}`;
}

function isPolicyValue(value: unknown): value is PetsPolicy | SmokingPolicy {
  return value === "FORBIDDEN" || value === "ON_REQUEST" || value === "ALLOWED";
}

function normalizeNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeNullableAge(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 17
  ) {
    return value;
  }

  return null;
}

function normalizeNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function buildRulesSnapshot(input: {
  checkInFrom: string;
  checkOutUntil: string;
  childrenAllowed: boolean | null;
  childrenMinAge: number | null;
  petsPolicy: PetsPolicy;
  smokingPolicy: SmokingPolicy;
  quietHoursEnabled: boolean | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  parkingInfo: string | null;
  mealOptions: string | null;
  prepaymentPolicy: string | null;
}): RulesSnapshot {
  return {
    checkInFrom: input.checkInFrom,
    checkOutUntil: input.checkOutUntil,
    childrenAllowed: input.childrenAllowed,
    childrenMinAge: input.childrenAllowed ? input.childrenMinAge : null,
    petsPolicy: input.petsPolicy,
    smokingPolicy: input.smokingPolicy,
    quietHoursEnabled: input.quietHoursEnabled,
    quietHoursFrom: input.quietHoursEnabled ? input.quietHoursFrom : null,
    quietHoursTo: input.quietHoursEnabled ? input.quietHoursTo : null,
    parkingInfo: input.parkingInfo || null,
    mealOptions: input.mealOptions || null,
    prepaymentPolicy: input.prepaymentPolicy || null,
  };
}

function isRulesSnapshotComplete(snapshot: RulesSnapshot): boolean {
  const childrenOk =
    (snapshot.childrenAllowed === false && snapshot.childrenMinAge === null) ||
    snapshot.childrenAllowed === true;

  const quietHoursOk =
    snapshot.quietHoursEnabled === false ||
    (snapshot.quietHoursEnabled === true && snapshot.quietHoursFrom && snapshot.quietHoursTo);

  return Boolean(
    snapshot.checkInFrom &&
    snapshot.checkOutUntil &&
    snapshot.childrenAllowed !== null &&
    childrenOk &&
    snapshot.petsPolicy &&
    snapshot.smokingPolicy &&
    snapshot.quietHoursEnabled !== null &&
    quietHoursOk,
  );
}

function parseRulesSnapshot(raw: string | null): RulesSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;

    return buildRulesSnapshot({
      checkInFrom: typeof value.checkInFrom === "string" ? value.checkInFrom : "",
      checkOutUntil: typeof value.checkOutUntil === "string" ? value.checkOutUntil : "",
      childrenAllowed: normalizeNullableBoolean(value.childrenAllowed),
      childrenMinAge: normalizeNullableAge(value.childrenMinAge),
      petsPolicy: isPolicyValue(value.petsPolicy) ? value.petsPolicy : "FORBIDDEN",
      smokingPolicy: isPolicyValue(value.smokingPolicy) ? value.smokingPolicy : "FORBIDDEN",
      quietHoursEnabled: normalizeNullableBoolean(value.quietHoursEnabled),
      quietHoursFrom: normalizeNullableText(value.quietHoursFrom),
      quietHoursTo: normalizeNullableText(value.quietHoursTo),
      parkingInfo: normalizeNullableText(value.parkingInfo),
      mealOptions: normalizeNullableText(value.mealOptions),
      prepaymentPolicy: normalizeNullableText(value.prepaymentPolicy),
    });
  } catch {
    return null;
  }
}

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

export function ObjectRulesPage({
  initialProperty,
  displayPropertyNumber,
  basePath = "/dashboard/objects",
}: ObjectRulesPageProps) {
  const router = useRouter();
  const [checkInFrom, setCheckInFrom] = useState(initialProperty.checkInFrom ?? "");
  const [checkOutUntil, setCheckOutUntil] = useState(initialProperty.checkOutUntil ?? "");
  const [childrenAllowed, setChildrenAllowed] = useState<boolean | null>(
    initialProperty.childrenAllowed,
  );
  const [childrenMinAge, setChildrenMinAge] = useState<number | null>(
    initialProperty.childrenMinAge,
  );
  const [petsPolicy, setPetsPolicy] = useState<PetsPolicy>(
    initialProperty.petsPolicy ?? "FORBIDDEN",
  );
  const [smokingPolicy, setSmokingPolicy] = useState<SmokingPolicy>(
    initialProperty.smokingPolicy ?? "FORBIDDEN",
  );
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean | null>(
    initialProperty.quietHoursEnabled,
  );
  const [quietHoursFrom, setQuietHoursFrom] = useState(initialProperty.quietHoursFrom ?? "");
  const [quietHoursTo, setQuietHoursTo] = useState(initialProperty.quietHoursTo ?? "");
  const [parkingInfo, setParkingInfo] = useState(initialProperty.parkingInfo ?? "");
  const [mealOptions, setMealOptions] = useState(initialProperty.mealOptions ?? "");
  const [prepaymentPolicy, setPrepaymentPolicy] = useState(initialProperty.prepaymentPolicy ?? "");
  const [registryNumber, setRegistryNumber] = useState(
    initialProperty.registryNumberPending ?? initialProperty.registryNumber ?? "",
  );
  const [isSavingRegistry, setIsSavingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState("");
  const [registrySuccess, setRegistrySuccess] = useState("");
  const [skipKsrConfirmed, setSkipKsrConfirmed] = useState(
    initialProperty.classificationApplicable === false,
  );
  const [error, setError] = useState("");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const draftStorageKey = getRulesDraftStorageKey(initialProperty.id);
  const initialSnapshot = JSON.stringify(
    buildRulesSnapshot({
      checkInFrom: initialProperty.checkInFrom ?? "",
      checkOutUntil: initialProperty.checkOutUntil ?? "",
      childrenAllowed: initialProperty.childrenAllowed,
      childrenMinAge: initialProperty.childrenMinAge,
      petsPolicy: initialProperty.petsPolicy ?? "FORBIDDEN",
      smokingPolicy: initialProperty.smokingPolicy ?? "FORBIDDEN",
      quietHoursEnabled: initialProperty.quietHoursEnabled,
      quietHoursFrom: initialProperty.quietHoursFrom ?? "",
      quietHoursTo: initialProperty.quietHoursTo ?? "",
      parkingInfo: initialProperty.parkingInfo ?? "",
      mealOptions: initialProperty.mealOptions ?? "",
      prepaymentPolicy: initialProperty.prepaymentPolicy ?? "",
    }),
  );
  const lastSavedSnapshotRef = useRef(initialSnapshot);
  const syncedCompletionRef = useRef(initialProperty.progress.step6);

  const canAutoSave =
    Boolean(checkInFrom && checkOutUntil) &&
    childrenAllowed !== null &&
    quietHoursEnabled !== null &&
    (!quietHoursEnabled || Boolean(quietHoursFrom && quietHoursTo));

  const currentRulesSnapshot = buildRulesSnapshot({
    checkInFrom,
    checkOutUntil,
    childrenAllowed,
    childrenMinAge,
    petsPolicy,
    smokingPolicy,
    quietHoursEnabled,
    quietHoursFrom,
    quietHoursTo,
    parkingInfo,
    mealOptions,
    prepaymentPolicy,
  });
  const rulesSnapshot = JSON.stringify(currentRulesSnapshot);
  const isRulesComplete = isRulesSnapshotComplete(currentRulesSnapshot);
  const savedRegistryNumber = (
    initialProperty.registryNumberPending ??
    initialProperty.registryNumber ??
    ""
  ).trim();
  const normalizedRegistryNumber = registryNumber.trim();
  const isRegistryComplete =
    initialProperty.classificationApplicable === false || normalizedRegistryNumber.length >= 3;

  const applySnapshot = useCallback((snapshot: RulesSnapshot) => {
    setCheckInFrom(snapshot.checkInFrom);
    setCheckOutUntil(snapshot.checkOutUntil);
    setChildrenAllowed(snapshot.childrenAllowed);
    setChildrenMinAge(snapshot.childrenMinAge);
    setPetsPolicy(snapshot.petsPolicy);
    setSmokingPolicy(snapshot.smokingPolicy);
    setQuietHoursEnabled(snapshot.quietHoursEnabled);
    setQuietHoursFrom(snapshot.quietHoursFrom ?? "");
    setQuietHoursTo(snapshot.quietHoursTo ?? "");
    setParkingInfo(snapshot.parkingInfo ?? "");
    setMealOptions(snapshot.mealOptions ?? "");
    setPrepaymentPolicy(snapshot.prepaymentPolicy ?? "");
  }, []);

  const persistDraftSnapshot = useCallback(
    (snapshot: string) => {
      try {
        window.sessionStorage.setItem(draftStorageKey, snapshot);
      } catch {
        // Ignore transient storage failures.
      }
    },
    [draftStorageKey],
  );

  const clearDraftSnapshot = useCallback(() => {
    try {
      window.sessionStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore transient storage failures.
    }
  }, [draftStorageKey]);

  const saveRulesSnapshot = useCallback(
    async (snapshot: string, signal?: AbortSignal): Promise<boolean> => {
      try {
        setError("");

        const response = await fetch(`/api/properties/${initialProperty.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: 6,
            data: JSON.parse(snapshot),
          }),
          signal,
        });

        if (!response.ok) {
          if (signal?.aborted) {
            return false;
          }

          setError(await readErrorMessage(response, "Не удалось сохранить правила проживания"));
          return false;
        }

        lastSavedSnapshotRef.current = snapshot;
        clearDraftSnapshot();

        const savedSnapshot = parseRulesSnapshot(snapshot);
        const savedIsComplete = savedSnapshot ? isRulesSnapshotComplete(savedSnapshot) : false;

        if (savedIsComplete !== syncedCompletionRef.current) {
          syncedCompletionRef.current = savedIsComplete;
          startTransition(() => {
            router.refresh();
          });
        }

        return true;
      } catch (cause: unknown) {
        if (signal?.aborted) {
          return false;
        }

        if (cause instanceof Error && cause.name === "AbortError") {
          return false;
        }

        setError("Не удалось сохранить правила проживания");
        return false;
      }
    },
    [clearDraftSnapshot, initialProperty.id, router],
  );

  const saveRegistry = useCallback(
    async (options?: { allowSkip?: boolean }): Promise<boolean> => {
      const normalizedNumber = registryNumber.trim();

      setRegistryError("");
      setRegistrySuccess("");

      if (!normalizedNumber) {
        if (!options?.allowSkip) {
          setRegistryError("Укажите номер записи в реестре КСР или отметьте, что он не требуется.");
          return false;
        }

        if (!skipKsrConfirmed) {
          setRegistryError(
            "Подтвердите, что объект размещается без КСР и не относится к средствам размещения, подлежащим классификации.",
          );
          return false;
        }

        setIsSavingRegistry(true);
        try {
          const response = await fetch(`/api/properties/${initialProperty.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              step: 7,
              data: {
                classificationApplicable: false,
                starRating: null,
                registryNumber: null,
                registryDetails: null,
                selfAssessmentPassed: null,
              },
            }),
          });

          if (!response.ok) {
            setRegistryError(
              await readErrorMessage(response, "Не удалось сохранить данные реестра"),
            );
            return false;
          }

          setRegistryNumber("");
          setRegistrySuccess("КСР отмечен как неприменимый для этого объекта.");
          startTransition(() => {
            router.refresh();
          });
          return true;
        } catch {
          setRegistryError("Не удалось сохранить данные реестра");
          return false;
        } finally {
          setIsSavingRegistry(false);
        }
      }

      if (normalizedNumber.length < 3) {
        setRegistryError("Номер записи в реестре слишком короткий");
        return false;
      }

      if (
        normalizedNumber === savedRegistryNumber &&
        initialProperty.classificationApplicable !== false
      ) {
        return true;
      }

      setIsSavingRegistry(true);
      try {
        const response = await fetch(`/api/properties/${initialProperty.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: 7,
            data: {
              classificationApplicable: true,
              starRating: null,
              registryNumber: normalizedNumber,
              registryDetails: null,
              selfAssessmentPassed: null,
            },
          }),
        });

        if (!response.ok) {
          setRegistryError(await readErrorMessage(response, "Не удалось сохранить данные реестра"));
          return false;
        }

        setRegistrySuccess(
          "Номер записи отправлен на проверку. После модерации он появится в карточке объекта.",
        );
        startTransition(() => {
          router.refresh();
        });
        return true;
      } catch {
        setRegistryError("Не удалось сохранить данные реестра");
        return false;
      } finally {
        setIsSavingRegistry(false);
      }
    },
    [
      initialProperty.classificationApplicable,
      initialProperty.id,
      registryNumber,
      router,
      savedRegistryNumber,
      skipKsrConfirmed,
    ],
  );

  const goNext = useCallback(async () => {
    setError("");

    if (!isRulesComplete) {
      setError("Заполните обязательные правила размещения: время, детей и тихие часы.");
      return;
    }

    const rulesSaved =
      rulesSnapshot === lastSavedSnapshotRef.current || (await saveRulesSnapshot(rulesSnapshot));
    if (!rulesSaved) {
      return;
    }

    const registrySaved = await saveRegistry({ allowSkip: true });
    if (!registrySaved) {
      return;
    }

    router.push(`${basePath}/${initialProperty.id}/room-categories`);
  }, [
    basePath,
    initialProperty.id,
    isRulesComplete,
    router,
    rulesSnapshot,
    saveRegistry,
    saveRulesSnapshot,
  ]);

  useEffect(() => {
    const savedDraft = parseRulesSnapshot(window.sessionStorage.getItem(draftStorageKey));

    if (savedDraft) {
      const savedDraftSnapshot = JSON.stringify(savedDraft);
      if (savedDraftSnapshot !== lastSavedSnapshotRef.current) {
        // Restoring a local draft is the whole purpose of this hydration-only effect.
        applySnapshot(savedDraft);
      }
    }

    setHasRestoredDraft(true);
  }, [applySnapshot, draftStorageKey]);

  useEffect(() => {
    if (!hasRestoredDraft) {
      return;
    }

    if (rulesSnapshot === lastSavedSnapshotRef.current) {
      clearDraftSnapshot();
      return;
    }

    persistDraftSnapshot(rulesSnapshot);
  }, [clearDraftSnapshot, hasRestoredDraft, persistDraftSnapshot, rulesSnapshot]);

  useEffect(() => {
    if (!hasRestoredDraft || !canAutoSave) {
      return;
    }

    const needsCompletionSync = isRulesComplete && !syncedCompletionRef.current;

    if (!needsCompletionSync && rulesSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    const abortController = new AbortController();

    // This effect exists specifically to keep the server draft in sync with valid local changes.
    void saveRulesSnapshot(rulesSnapshot, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [canAutoSave, hasRestoredDraft, isRulesComplete, rulesSnapshot, saveRulesSnapshot]);

  useEffect(() => {
    if (!hasRestoredDraft) {
      return;
    }

    const handlePageHide = () => {
      if (rulesSnapshot !== lastSavedSnapshotRef.current) {
        persistDraftSnapshot(rulesSnapshot);
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [hasRestoredDraft, persistDraftSnapshot, rulesSnapshot]);

  useEffect(() => {
    if (!hasRestoredDraft) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const objectBasePath = `${basePath}/${initialProperty.id}`;
      const isObjectNavigation =
        nextUrl.origin === currentUrl.origin &&
        (nextUrl.pathname === basePath ||
          nextUrl.pathname === objectBasePath ||
          nextUrl.pathname.startsWith(`${objectBasePath}/`));

      if (!isObjectNavigation) {
        return;
      }

      const hasUnsavedChanges = rulesSnapshot !== lastSavedSnapshotRef.current;
      if (!hasUnsavedChanges) {
        return;
      }

      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      ) {
        return;
      }

      event.preventDefault();

      void (async () => {
        persistDraftSnapshot(rulesSnapshot);

        if (canAutoSave) {
          const saved = await saveRulesSnapshot(rulesSnapshot);
          if (!saved) {
            return;
          }
        }

        router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      })();
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [
    canAutoSave,
    hasRestoredDraft,
    basePath,
    initialProperty.id,
    persistDraftSnapshot,
    router,
    rulesSnapshot,
    saveRulesSnapshot,
  ]);

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-olive/10 bg-white/95 p-5 shadow-[0_22px_58px_rgba(58,43,35,0.08)] ring-1 ring-white/70 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold leading-tight text-olive sm:text-3xl">
              Создание объекта · Шаг 2. Правила размещения
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-olive/64">
              Укажите правила проживания и при необходимости регистрационные данные. Это помогает
              гостям и повышает доверие.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-olive/64">
            Объект #{displayPropertyNumber}
          </span>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-olive/8">
            <div className="h-full w-[40%] rounded-full bg-primary" />
          </div>
          <span className="text-xs font-semibold text-olive/55">~40%</span>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden rounded-[22px] border border-olive/10 bg-white shadow-[0_16px_44px_rgba(58,43,35,0.06)]">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-olive/8 bg-cream/40 px-5 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <AppIcon icon={ClipboardList} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-olive">Правила размещения</h2>
              <p className="mt-0.5 text-sm text-olive/55">Условия заселения и пребывания гостей</p>
            </div>
          </div>

          <div className="divide-y divide-olive/8">
            {/* Check-in / Check-out */}
            <div className="px-5 py-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Время заезда и выезда
              </p>
              <p className="mb-3 text-xs text-olive/50">
                Во сколько гости могут заселиться и до скольки должны выехать
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-olive">
                    <AppIcon icon={Sunrise} className="h-4 w-4 text-sun" />
                    Заезд после
                  </span>
                  <TimePicker
                    name="checkInFrom"
                    value={checkInFrom}
                    onChange={setCheckInFrom}
                    ariaLabel="Время заезда"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-olive">
                    <AppIcon icon={Sunset} className="h-4 w-4" />
                    Выезд до
                  </span>
                  <TimePicker
                    name="checkOutUntil"
                    value={checkOutUntil}
                    onChange={setCheckOutUntil}
                    ariaLabel="Время выезда"
                  />
                </label>
              </div>
            </div>

            {/* Children */}
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="flex items-center gap-2 text-sm font-medium text-olive">
                    <AppIcon icon={Baby} className="h-4 w-4" />
                    Размещение с детьми
                  </span>
                  <p className="mt-0.5 pl-6 text-xs text-olive/50">
                    Принимаете ли вы гостей с детьми?
                  </p>
                </div>
                <div className="inline-flex gap-0.5 rounded-xl border border-olive/12 bg-cream/60 p-1">
                  <button
                    type="button"
                    onClick={() => setChildrenAllowed(true)}
                    className={
                      childrenAllowed === true
                        ? "rounded-[9px] bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition"
                        : "rounded-[9px] px-4 py-1.5 text-sm font-semibold text-olive/55 transition hover:text-olive"
                    }
                  >
                    Разрешены
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChildrenAllowed(false);
                      setChildrenMinAge(null);
                    }}
                    className={
                      childrenAllowed === false
                        ? "rounded-[9px] bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition"
                        : "rounded-[9px] px-4 py-1.5 text-sm font-semibold text-olive/55 transition hover:text-olive"
                    }
                  >
                    Запрещены
                  </button>
                </div>
              </div>
              {childrenAllowed ? (
                <div className="mt-3">
                  <Input
                    type="number"
                    min={0}
                    max={17}
                    value={childrenMinAge ?? ""}
                    onChange={(event) =>
                      setChildrenMinAge(event.target.value ? Number(event.target.value) : null)
                    }
                    placeholder="Минимальный возраст детей (лет)"
                  />
                  <p className="mt-2 text-xs text-olive/65">
                    Если поле оставить пустым, разрешены дети любого возраста.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Policies: Animals & Smoking */}
            <div className="px-5 py-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Политики
              </p>
              <p className="mb-3 text-xs text-olive/50">
                Правила для животных и курения на территории
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-olive">
                    <AppIcon icon={PawPrint} className="h-4 w-4" />
                    Животные
                  </span>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-olive/15 bg-white py-2.5 pl-3.5 pr-9 text-sm text-olive focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={petsPolicy}
                      onChange={(event) => setPetsPolicy(event.target.value as PetsPolicy)}
                    >
                      {petsPolicyOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--icon-nav)]">
                      <AppIcon icon={ChevronDown} className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-olive">
                    <AppIcon icon={CigaretteOff} className="h-4 w-4" />
                    Курение
                  </span>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-olive/15 bg-white py-2.5 pl-3.5 pr-9 text-sm text-olive focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={smokingPolicy}
                      onChange={(event) => setSmokingPolicy(event.target.value as SmokingPolicy)}
                    >
                      {smokingPolicyOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--icon-nav)]">
                      <AppIcon icon={ChevronDown} className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="flex items-center gap-2 text-sm font-medium text-olive">
                    <AppIcon icon={Moon} className="h-4 w-4" />
                    Тихие часы
                  </span>
                  <p className="mt-0.5 pl-6 text-xs text-olive/50">
                    Время, когда нужно соблюдать тишину
                  </p>
                </div>
                <div className="inline-flex gap-0.5 rounded-xl border border-olive/12 bg-cream/60 p-1">
                  <button
                    type="button"
                    onClick={() => setQuietHoursEnabled(true)}
                    className={
                      quietHoursEnabled === true
                        ? "rounded-[9px] bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition"
                        : "rounded-[9px] px-4 py-1.5 text-sm font-semibold text-olive/55 transition hover:text-olive"
                    }
                  >
                    Да
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuietHoursEnabled(false);
                      setQuietHoursFrom("");
                      setQuietHoursTo("");
                    }}
                    className={
                      quietHoursEnabled === false
                        ? "rounded-[9px] bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition"
                        : "rounded-[9px] px-4 py-1.5 text-sm font-semibold text-olive/55 transition hover:text-olive"
                    }
                  >
                    Нет
                  </button>
                </div>
              </div>
              {quietHoursEnabled ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-olive/60">Начало</span>
                    <TimePicker
                      name="quietHoursFrom"
                      value={quietHoursFrom}
                      onChange={setQuietHoursFrom}
                      ariaLabel="Начало тихих часов"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-olive/60">Конец</span>
                    <TimePicker
                      name="quietHoursTo"
                      value={quietHoursTo}
                      onChange={setQuietHoursTo}
                      ariaLabel="Конец тихих часов"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {/* Extra conditions: Parking / Meals / Prepayment */}
            <div className="px-5 py-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                Дополнительные условия
              </p>
              <p className="mb-3 text-xs text-olive/50">
                Необязательно — укажите парковку, питание и предоплату, если они есть
              </p>
              <PropertyRulesExtraFields
                parkingInfo={parkingInfo}
                onParkingInfoChange={setParkingInfo}
                mealOptions={mealOptions}
                onMealOptionsChange={setMealOptions}
                prepaymentPolicy={prepaymentPolicy}
                onPrepaymentPolicyChange={setPrepaymentPolicy}
              />
            </div>

            {/* Registry */}
            <div className="px-5 py-4">
              <section className="rounded-[18px] border border-olive/10 bg-foam/45 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <AppIcon icon={ShieldCheck} className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-olive">Регистрация в КСР</h2>
                    <p className="mt-0.5 text-xs text-olive/50">
                      Реестр классифицированных средств размещения
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm leading-6 text-olive/68">
                  <p>
                    Номер записи в КСР обязателен, если объект является средством размещения:
                    гостиницей, отелем, хостелом, апарт-отелем, санаторием, базой отдыха,
                    турбазой, глэмпингом, кемпингом или похожим объектом, который оказывает услуги
                    временного проживания.
                  </p>
                  <p>
                    Обычно классификации не подлежат отдельные квартиры, комнаты, жилые дома или
                    отдельные апартаменты, которые сдаются как самостоятельное жилое помещение и не
                    работают как гостиница, гостевой дом, база отдыха или иной объект размещения.
                  </p>
                  <p className="text-xs leading-5 text-olive/55">
                    Основание: Федеральный закон N 132-ФЗ, постановления Правительства РФ N 1951 и
                    N 1952 от 27.12.2024. За нарушения требований к услугам средств размещения
                    предусмотрена административная ответственность по ст. 14.39 КоАП РФ.
                  </p>
                </div>

                <label className="mt-5 block space-y-2">
                  <span className="text-sm font-semibold text-olive">Номер записи в реестре</span>
                  <Input
                    value={registryNumber}
                    onChange={(event) => {
                      setRegistryNumber(event.target.value);
                      if (event.target.value.trim()) {
                        setSkipKsrConfirmed(false);
                      }
                      setRegistryError("");
                      setRegistrySuccess("");
                    }}
                    placeholder="Введите номер записи (при наличии)"
                  />
                </label>

                {initialProperty.registryModerationPending ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    На проверке: {initialProperty.registryNumberPending}
                  </p>
                ) : null}
                {!initialProperty.registryModerationPending && initialProperty.registryNumber ? (
                  <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs leading-5 text-primary">
                    Подтвержденный номер: {initialProperty.registryNumber}
                  </p>
                ) : null}
                {initialProperty.classificationApplicable === false && !normalizedRegistryNumber ? (
                  <p className="mt-3 rounded-xl bg-sage/20 px-3 py-2 text-xs leading-5 text-olive">
                    КСР отмечен как неприменимый для этого объекта.
                  </p>
                ) : null}
                {registryError ? (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                    {registryError}
                  </p>
                ) : null}
                {registrySuccess ? (
                  <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs leading-5 text-primary">
                    {registrySuccess}
                  </p>
                ) : null}

                <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-5 text-amber-900">
                  <Checkbox
                    checked={skipKsrConfirmed}
                    onChange={(event) => {
                      setSkipKsrConfirmed(event.target.checked);
                      setRegistryError("");
                      setRegistrySuccess("");
                    }}
                    disabled={normalizedRegistryNumber.length > 0 || isSavingRegistry}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Да, подтверждаю: объект будет размещен без номера КСР, потому что он не
                    относится к средствам размещения, подлежащим классификации. Я понимаю, что если
                    объект фактически является средством размещения, ответственность за размещение и
                    оказание услуг без обязательной классификации несет владелец объекта, в том
                    числе по ст. 14.39 КоАП РФ.
                  </span>
                </label>

                <div className="mt-4 grid gap-2">
                  <a
                    href="https://tourism.fsa.gov.ru/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
                  >
                    Открыть реестр
                    <AppIcon icon={ExternalLink} className="h-4 w-4" />
                  </a>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void saveRegistry()}
                      disabled={isSavingRegistry || !normalizedRegistryNumber}
                      className="inline-flex items-center justify-center rounded-xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/25 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Сохранить КСР
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveRegistry({ allowSkip: true })}
                      disabled={
                        isSavingRegistry ||
                        isRegistryComplete ||
                        normalizedRegistryNumber.length > 0 ||
                        !skipKsrConfirmed
                      }
                      className="inline-flex items-center justify-center rounded-xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive/70 transition hover:border-primary/25 hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Сохранить без КСР
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-olive/8 bg-cream/20 px-5 py-4">
            {error ? (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`${basePath}/${initialProperty.id}/about`}
                className="text-sm font-semibold text-terra hover:underline"
              >
                Назад
              </Link>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={isSavingRegistry}
                  className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingRegistry ? "Сохраняем..." : "Далее"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[22px] border border-olive/10 bg-white p-5 shadow-[0_16px_44px_rgba(58,43,35,0.06)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sun/15 text-sun">
                <AppIcon icon={CircleHelp} className="h-5 w-5" />
              </span>
              <h2 className="font-semibold text-olive">Как заполнить проще</h2>
            </div>
            <div className="mt-5 space-y-4">
              {[
                ["Будьте конкретны", "Чёткие правила помогают избежать недоразумений."],
                ["Думайте как гость", "Укажите важные детали заранее — это повышает доверие."],
                ["Не усложняйте", "Достаточно базовых правил. Остальное можно описать в карточке."],
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <AppIcon icon={CheckCircle2} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-olive">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-olive/58">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
