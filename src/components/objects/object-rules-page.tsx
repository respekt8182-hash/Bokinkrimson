"use client";

import type { PetsPolicy, SmokingPolicy } from "@prisma/client";
import {
  Baby,
  ChevronDown,
  CigaretteOff,
  ClipboardList,
  Moon,
  PawPrint,
  Sunrise,
  Sunset,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { PropertyRulesExtraFields } from "@/components/objects/property-rules-extra-fields";
import { AppIcon } from "@/components/ui/app-icon";
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

          setError(
            await readErrorMessage(response, "Не удалось сохранить правила проживания"),
          );
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

  useEffect(() => {
    const savedDraft = parseRulesSnapshot(window.sessionStorage.getItem(draftStorageKey));

    if (savedDraft) {
      const savedDraftSnapshot = JSON.stringify(savedDraft);
      if (savedDraftSnapshot !== lastSavedSnapshotRef.current) {
        // Restoring a local draft is the whole purpose of this hydration-only effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="rounded-2xl bg-cream p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-olive/60">
              ID объекта: {displayPropertyNumber}
            </p>
          </div>
          <span className="rounded-full bg-sage/25 px-3 py-1 text-xs font-semibold uppercase text-olive">
            {initialProperty.statusLabel}
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-olive/10 bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-olive/8 bg-cream/40 px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AppIcon icon={ClipboardList} className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-olive">Правила проживания</h2>
            <p className="mt-0.5 text-sm text-olive/55">Условия заселения и пребывания гостей</p>
          </div>
        </div>

        <div className="divide-y divide-olive/8">
          {/* Intro hint */}
          <div className="px-5 py-3">
            <p className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive/70">
              Заполните правила проживания — время заезда/выезда и основные политики. Эта информация отображается в карточке объекта и помогает гостям заранее узнать условия. Данные сохраняются автоматически.
            </p>
          </div>

          {/* Check-in / Check-out */}
          <div className="px-5 py-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-olive/40">
              Время заезда и выезда
            </p>
            <p className="mb-3 text-xs text-olive/50">Во сколько гости могут заселиться и до скольки должны выехать</p>
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
                <p className="mt-0.5 pl-6 text-xs text-olive/50">Принимаете ли вы гостей с детьми?</p>
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
            <p className="mb-3 text-xs text-olive/50">Правила для животных и курения на территории</p>
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
                <p className="mt-0.5 pl-6 text-xs text-olive/50">Время, когда нужно соблюдать тишину</p>
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
            <p className="mb-3 text-xs text-olive/50">Необязательно — укажите парковку, питание и предоплату, если они есть</p>
            <PropertyRulesExtraFields
              parkingInfo={parkingInfo}
              onParkingInfoChange={setParkingInfo}
              mealOptions={mealOptions}
              onMealOptionsChange={setMealOptions}
              prepaymentPolicy={prepaymentPolicy}
              onPrepaymentPolicyChange={setPrepaymentPolicy}
            />
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
              <Link
                href={`${basePath}/${initialProperty.id}/room-categories`}
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Далее
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
