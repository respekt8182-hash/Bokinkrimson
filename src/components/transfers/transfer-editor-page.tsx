"use client";

import {
  CalendarDays,
  Car,
  Check,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  CreditCard,
  FileText,
  Globe,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { type TextareaHTMLAttributes, useEffect, useMemo, useState } from "react";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";
import { TransferFleetBuilder } from "@/components/transfers/transfer-fleet-builder";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { SerializedPayment } from "@/lib/payments";
import {
  buildTransferTitleSuggestion,
  deriveTransferSummaryFromFleet,
  isTransferReadyForModeration,
  transferTypeOptions,
  type TransferFleetItem,
} from "@/lib/transfers";

type TransferEditorAction = (formData: FormData) => void | Promise<void>;

type StepId = "info" | "location" | "fleet" | "contacts" | "publish";
type TransferStatusValue = "DRAFT" | "PENDING_MODERATION" | "PUBLISHED" | "REJECTED";

type LocationSuggestionItem = {
  id: string;
  name: string;
};

type ReverseGeocodeItem = {
  address: string;
  localityName?: string | null;
  localityDisplayName?: string | null;
};

type TransferEditorPageProps = {
  action: TransferEditorAction;
  transfer: {
    id: string;
    status: TransferStatusValue;
    statusLabel: string;
    title: string;
    transferType: string;
    description: string;
    locationId: string;
    locationName: string;
    routeExamples: string;
    latitude: string;
    longitude: string;
    contactName: string;
    phone: string;
    phone2: string;
    websiteUrl: string;
    whatsappUrl: string;
    telegramUrl: string;
    vkUrl: string;
    maxUrl: string;
    okUrl: string;
    moderationNotes: string;
    reviewsCount: number;
    avgRating: number | null;
  };
  locations: Array<{
    id: string;
    name: string;
  }>;
  initialFleet: TransferFleetItem[];
  initialServiceTags: string[];
  publicPath: string | null;
  publicationFeeRub: number;
  initialPayments: SerializedPayment[];
  saved: boolean;
  paymentNotice?: string | null;
  initialStep?: StepId | null;
};

const stepOrder: StepId[] = ["info", "location", "fleet", "contacts", "publish"];
const TRANSFER_PAYMENT_VALIDITY_DAYS = 365;

const stepMeta: Array<{
  id: StepId;
  title: string;
  shortTitle: string;
  icon: typeof FileText;
}> = [
  { id: "info", title: "Карточка услуги", shortTitle: "Карточка", icon: FileText },
  { id: "location", title: "География", shortTitle: "География", icon: MapPin },
  { id: "fleet", title: "Автопарк", shortTitle: "Автопарк", icon: Car },
  { id: "contacts", title: "Контакты", shortTitle: "Контакты", icon: Phone },
  { id: "publish", title: "Оплата", shortTitle: "Оплата", icon: ShieldCheck },
];

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/22",
        props.className,
      )}
    />
  );
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value)} ₽`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function isOpenPayment(status: SerializedPayment["status"]): boolean {
  return status === "CREATED" || status === "PENDING";
}

function getTransferPaymentValidUntil(payment: SerializedPayment): string | null {
  if (payment.placementValidUntil) {
    return payment.placementValidUntil;
  }

  const anchor = payment.paidAt ?? payment.createdAt;
  const date = new Date(anchor);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + TRANSFER_PAYMENT_VALIDITY_DAYS);
  return date.toISOString();
}

function getTransferPaymentTariffLabel(tariffCode: string): string {
  return tariffCode.startsWith("transfer_standard")
    ? "Публикация карточки трансфера"
    : tariffCode;
}

function getPaymentProviderLabel(provider: SerializedPayment["provider"]): string {
  if (provider === "MANAGER") {
    return "Через менеджера";
  }

  if (provider === "YOOKASSA") {
    return "YooKassa";
  }

  return provider;
}

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /^(?:г\.?|город|пгт|с\.?|село|пос\.?|поселок(?:\s+городского\s+типа)?|посёлок(?:\s+городского\s+типа)?|д\.?|деревня|х\.?|хутор)\s+/,
      "",
    )
    .replace(/\s+/g, " ");
}

function getInitialStep(input: {
  infoReady: boolean;
  locationReady: boolean;
  fleetReady: boolean;
  contactsReady: boolean;
  publishReady: boolean;
}): StepId {
  if (!input.infoReady) return "info";
  if (!input.locationReady) return "location";
  if (!input.fleetReady) return "fleet";
  if (!input.contactsReady) return "contacts";
  if (!input.publishReady) return "publish";
  return "publish";
}

function findLocationSuggestion(
  value: string,
  items: Array<{ id: string; name: string }>,
): LocationSuggestionItem | null {
  const normalizedValue = normalizeLocation(value);
  if (!normalizedValue) {
    return null;
  }

  return items.find((item) => normalizeLocation(item.name) === normalizedValue) ?? null;
}

export function TransferEditorPage({
  action,
  transfer,
  locations,
  initialFleet,
  initialServiceTags,
  publicPath,
  publicationFeeRub,
  initialPayments,
  saved,
  paymentNotice = null,
  initialStep = null,
}: TransferEditorPageProps) {
  const initialSuggestedTitle = buildTransferTitleSuggestion({
    transferType: transfer.transferType,
    locationName: transfer.locationName,
    serviceTags: initialServiceTags,
    fleet: initialFleet,
  });
  const initialTitle = transfer.title.trim();
  const [titleTouched, setTitleTouched] = useState(
    () =>
      initialTitle.length > 0 &&
      initialTitle !== "Новый трансфер" &&
      initialTitle !== initialSuggestedTitle,
  );
  const [manualTitle, setManualTitle] = useState(
    initialTitle || initialSuggestedTitle || "Трансфер",
  );
  const [transferType, setTransferType] = useState(transfer.transferType);
  const [description, setDescription] = useState(transfer.description);
  const [locationName, setLocationName] = useState(transfer.locationName);
  const [selectedLocationId, setSelectedLocationId] = useState(transfer.locationId);
  const [latitude, setLatitude] = useState<number | null>(
    transfer.latitude ? Number(transfer.latitude) : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    transfer.longitude ? Number(transfer.longitude) : null,
  );
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestionItem[]>(
    locations.slice(0, 8),
  );
  const [contactName, setContactName] = useState(transfer.contactName);
  const [phone, setPhone] = useState(transfer.phone);
  const [phone2, setPhone2] = useState(transfer.phone2);
  const [websiteUrl, setWebsiteUrl] = useState(transfer.websiteUrl);
  const [whatsappUrl, setWhatsappUrl] = useState(transfer.whatsappUrl);
  const [telegramUrl, setTelegramUrl] = useState(transfer.telegramUrl);
  const [vkUrl, setVkUrl] = useState(transfer.vkUrl);
  const [maxUrl, setMaxUrl] = useState(transfer.maxUrl);
  const [okUrl, setOkUrl] = useState(transfer.okUrl);
  const [showPhone2, setShowPhone2] = useState(Boolean(transfer.phone2));
  const [showWebsite, setShowWebsite] = useState(Boolean(transfer.websiteUrl));
  const [showWhatsapp, setShowWhatsapp] = useState(Boolean(transfer.whatsappUrl));
  const [showTelegram, setShowTelegram] = useState(Boolean(transfer.telegramUrl));
  const [showVk, setShowVk] = useState(Boolean(transfer.vkUrl));
  const [showMax, setShowMax] = useState(Boolean(transfer.maxUrl));
  const [showOk, setShowOk] = useState(Boolean(transfer.okUrl));
  const [fleet, setFleet] = useState<TransferFleetItem[]>(initialFleet);
  const [serviceTags, setServiceTags] = useState<string[]>(initialServiceTags);
  const [paymentProvider, setPaymentProvider] = useState<"YOOKASSA" | "MANAGER">("YOOKASSA");
  const [payments, setPayments] = useState(initialPayments);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const effectiveLocationName = locationName.trim();
  const suggestedTitle = useMemo(
    () =>
      buildTransferTitleSuggestion({
        transferType,
        locationName: effectiveLocationName,
        serviceTags,
        fleet,
      }),
    [effectiveLocationName, fleet, serviceTags, transferType],
  );
  const title = titleTouched ? manualTitle : suggestedTitle;
  const fleetSummary = useMemo(
    () =>
      deriveTransferSummaryFromFleet({
        fleet,
        photoUrls: [],
        priceUnitLabel: null,
      }),
    [fleet],
  );

  useEffect(() => {
    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const query = locationName.trim();
        const response = await fetch(
          `/api/reference/locations?query=${encodeURIComponent(query)}`,
          { signal: abortController.signal },
        );
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { items?: LocationSuggestionItem[] };
        setLocationSuggestions(body.items?.slice(0, 8) ?? []);
      } catch {
        // Ignore transient typing errors.
      }
    }, 180);

    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, [locationName]);

  const matchedLocation =
    findLocationSuggestion(effectiveLocationName, locationSuggestions) ??
    findLocationSuggestion(effectiveLocationName, locations);
  const locationId = selectedLocationId || matchedLocation?.id || "";

  const hasVehicleSummary = Boolean(
    fleetSummary.primaryVehicle?.vehicleModel ||
    fleetSummary.primaryVehicle?.vehicleClass ||
    fleetSummary.primaryVehicle?.transportKind ||
    fleetSummary.primaryVehicle?.title,
  );
  const infoReady =
    Boolean(title.trim()) && Boolean(description.trim()) && Boolean(transferType.trim());
  const locationReady = Boolean(effectiveLocationName);
  const fleetReady =
    fleetSummary.fleet.length > 0 &&
    hasVehicleSummary &&
    Boolean(fleetSummary.priceFrom) &&
    fleetSummary.photoUrls.length > 0;
  const contactsReady = Boolean(contactName.trim()) && Boolean(phone.trim());
  const publishReady = isTransferReadyForModeration({
    title,
    description,
    transferType,
    locationName: effectiveLocationName,
    contactName,
    phone,
    fleet,
    photoUrls: fleetSummary.photoUrls,
  });

  const defaultInitialStep = useMemo(
    () =>
      getInitialStep({
        infoReady,
        locationReady,
        fleetReady,
        contactsReady,
        publishReady,
      }),
    [contactsReady, fleetReady, infoReady, locationReady, publishReady],
  );
  const [activeStep, setActiveStep] = useState<StepId>(initialStep ?? defaultInitialStep);

  const steps = [
    { id: "info" as const, title: "Карточка услуги", done: infoReady },
    { id: "location" as const, title: "География", done: locationReady },
    { id: "fleet" as const, title: "Автопарк", done: fleetReady },
    { id: "contacts" as const, title: "Контакты", done: contactsReady },
    { id: "publish" as const, title: "Оплата", done: publishReady },
  ];

  const checklist: Array<{ label: string; done: boolean; step: StepId }> = [
    { label: "Есть название, тип услуги и описание", done: infoReady, step: "info" },
    { label: "Указан город работы", done: locationReady, step: "location" },
    { label: "Добавлены фото, транспорт и цена", done: fleetReady, step: "fleet" },
    { label: "Заполнены контакты для связи", done: contactsReady, step: "contacts" },
    { label: "Карточка готова к модерации", done: publishReady, step: "publish" },
  ];

  const activeStepIndex = stepOrder.indexOf(activeStep);
  const previousStep = activeStepIndex > 0 ? stepOrder[activeStepIndex - 1] : null;
  const nextStep =
    activeStepIndex >= 0 && activeStepIndex < stepOrder.length - 1
      ? stepOrder[activeStepIndex + 1]
      : null;
  const activeStepTitle = stepMeta.find((item) => item.id === activeStep)?.title ?? "Раздел";
  const completedStepsCount = steps.filter((item) => item.done).length;
  const progressPercent = Math.round((completedStepsCount / steps.length) * 100);
  const displayTitle = title.trim() || suggestedTitle || "Новый трансфер";
  const paymentNoticeText =
    paymentNotice === "manager"
      ? "Заявка на оплату отправлена менеджеру. После подтверждения оплаты карточка уйдет на модерацию."
      : paymentNotice === "paid"
        ? "Оплата найдена. Карточка отправлена на модерацию."
        : paymentNotice === "pending"
          ? "По этой карточке уже есть незавершенный платеж."
          : paymentNotice === "yookassa-unavailable"
            ? "YooKassa сейчас недоступна. Выберите оплату через менеджера."
            : paymentNotice === "provider-disabled"
              ? "Выбранный способ оплаты временно недоступен."
              : paymentNotice === "not-ready"
                ? "Заполните обязательные поля перед оплатой и модерацией."
                : paymentNotice === "yookassa-error"
                  ? "Не удалось создать платеж YooKassa. Попробуйте оплату через менеджера."
                  : paymentNotice === "schema-missing"
                    ? "Оплата трансферов временно недоступна. Обновите страницу после завершения обслуживания."
                    : null;
  const latestPayment = payments[0] ?? null;
  const latestSucceededPayment =
    payments.find((payment) => payment.status === "SUCCEEDED") ?? null;
  const latestPaymentIsOpen = latestPayment ? isOpenPayment(latestPayment.status) : false;
  const hasSucceededPayment = Boolean(latestSucceededPayment);
  const managerPaymentPending =
    latestPaymentIsOpen && latestPayment?.provider === "MANAGER";
  const yookassaPaymentUrl =
    latestPaymentIsOpen && latestPayment?.provider === "YOOKASSA"
      ? latestPayment.confirmationUrl
      : null;
  const alreadyOnModeration =
    transfer.status === "PENDING_MODERATION" || transfer.status === "PUBLISHED";
  const canSubmitPaidCard =
    publishReady &&
    hasSucceededPayment &&
    (transfer.status === "DRAFT" || transfer.status === "REJECTED");
  const canCreatePayment =
    publishReady &&
    !latestPaymentIsOpen &&
    !hasSucceededPayment &&
    (transfer.status === "DRAFT" || transfer.status === "REJECTED");
  const canUsePrimaryPaymentSubmit = canSubmitPaidCard || canCreatePayment;
  const primaryPaymentLabel = !publishReady
    ? "Заполните обязательные поля"
    : canSubmitPaidCard
      ? "Отправить на модерацию"
      : latestPaymentIsOpen
        ? latestPayment?.provider === "MANAGER"
          ? "Заявка уже у менеджера"
          : "Платеж уже создан"
        : hasSucceededPayment
          ? "Оплата подтверждена"
          : paymentProvider === "MANAGER"
            ? "Отправить заявку менеджеру"
            : "Перейти к оплате";
  const readinessIssues = checklist.filter((item) => !item.done && item.step !== "publish");
  const paidUntil = latestSucceededPayment
    ? getTransferPaymentValidUntil(latestSucceededPayment)
    : null;
  const transferStatusMeta: Record<
    TransferStatusValue,
    { label: string; dot: string; bg: string; text: string }
  > = {
    DRAFT: {
      label: "Черновик",
      dot: "bg-olive/40",
      bg: "bg-olive/8",
      text: "text-olive/70",
    },
    PENDING_MODERATION: {
      label: "На модерации",
      dot: "bg-amber-400",
      bg: "bg-amber-50",
      text: "text-amber-700",
    },
    PUBLISHED: {
      label: "Опубликована",
      dot: "bg-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
    REJECTED: {
      label: "Отклонена",
      dot: "bg-red-400",
      bg: "bg-red-50",
      text: "text-red-700",
    },
  };
  const statusMeta = transferStatusMeta[transfer.status] ?? transferStatusMeta.DRAFT;
  const paymentReadinessHint = !publishReady
    ? "Перед оплатой заполните обязательные разделы ниже."
    : alreadyOnModeration
      ? transfer.status === "PUBLISHED"
        ? "Карточка уже опубликована. Повторная оплата сейчас не требуется."
        : "Карточка уже отправлена на модерацию."
      : hasSucceededPayment
        ? "Оплата подтверждена. Карточку можно отправить на модерацию без повторной оплаты."
        : latestPaymentIsOpen
          ? "По карточке уже есть незавершенный платеж. Завершите его или дождитесь менеджера."
          : "Карточка готова к оплате и последующей отправке на модерацию.";

  function updatePaymentInState(item: SerializedPayment) {
    setPayments((currentPayments) => {
      const next = currentPayments.map((payment) =>
        payment.id === item.id ? item : payment,
      );

      if (!next.some((payment) => payment.id === item.id)) {
        next.unshift(item);
      }

      return next.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    });
  }

  async function refreshLatestPaymentStatus() {
    if (!latestPayment) {
      return;
    }

    setIsRefreshingPayment(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(`/api/payments/${latestPayment.id}`);
      const body = (await response.json()) as { error?: string; item?: SerializedPayment };

      if (!response.ok || !body.item) {
        setPaymentError(body.error ?? "Не удалось обновить статус платежа.");
        return;
      }

      updatePaymentInState(body.item);

      if (body.item.status === "SUCCEEDED") {
        setPaymentMessage("Оплата подтверждена. Карточка будет отправлена на модерацию.");
      }
    } finally {
      setIsRefreshingPayment(false);
    }
  }

  function switchStep(stepId: StepId) {
    setActiveStep(stepId);
  }

  function goToPreviousStep() {
    if (previousStep) {
      setActiveStep(previousStep);
    }
  }

  function goToNextStep() {
    if (nextStep) {
      setActiveStep(nextStep);
    }
  }

  function handleMapResolved(item: ReverseGeocodeItem) {
    const resolvedName =
      item.localityDisplayName?.trim() || item.localityName?.trim() || item.address.trim();
    if (!resolvedName) {
      return;
    }

    setLocationName(resolvedName);
    const exactMatch =
      findLocationSuggestion(resolvedName, locationSuggestions) ??
      findLocationSuggestion(resolvedName, locations);
    setSelectedLocationId(exactMatch?.id ?? "");
  }

  function removableField({
    shown,
    onHide,
    icon,
    brand,
    placeholder,
    name,
    value,
    onChange,
  }: {
    shown: boolean;
    onHide: () => void;
    icon?: typeof Globe;
    brand?: "whatsapp" | "telegram" | "vk" | "max" | "ok";
    placeholder: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
  }) {
    if (!shown) {
      return null;
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/45">
          {brand ? (
            <ContactBrandMark brand={brand} bare className="h-4 w-4" />
          ) : icon ? (
            <AppIcon icon={icon} className="h-4 w-4" />
          ) : null}
        </span>
        <Input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        <button
          type="button"
          onClick={onHide}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-olive/45 transition hover:text-olive"
          aria-label="Убрать поле"
        >
          <AppIcon icon={X} className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 pb-28 sm:space-y-5 sm:pb-0">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="latitude" value={latitude !== null ? String(latitude) : ""} />
      <input type="hidden" name="longitude" value={longitude !== null ? String(longitude) : ""} />
      <input type="hidden" name="paymentProvider" value={paymentProvider} />

      <div className="space-y-4 overflow-hidden rounded-3xl border border-primary/18 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_18px_34px_-26px_rgba(15,118,110,0.95)] sm:p-6">
        <div className="sm:hidden">
          <div className="rounded-[24px] border border-primary/12 bg-white/88 p-3 shadow-[0_20px_38px_-26px_rgba(15,118,110,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/60">
                  Этап {activeStepIndex + 1}/{steps.length}
                </p>
                <p className="mt-1 truncate text-lg font-semibold text-olive">{activeStepTitle}</p>
              </div>
              <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {completedStepsCount}/{steps.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-2">
            <Link
              href="/dashboard/transfers"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/55 transition hover:text-primary"
            >
              Все трансферы
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl text-olive sm:text-3xl">{displayTitle}</h1>
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                этап {activeStepIndex + 1} из {steps.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary shadow-sm shadow-primary/10">
              {transfer.statusLabel}
            </span>
            {publicPath ? (
              <Link
                href={publicPath}
                className="inline-flex items-center rounded-full border border-olive/12 bg-white/85 px-3 py-1 text-xs font-semibold text-olive transition hover:border-primary/25 hover:text-primary"
              >
                Публичная страница
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 backdrop-blur-sm sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                Прогресс заполнения
              </span>
              <span className="text-xs font-semibold tabular-nums text-primary">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/12">
              <div
                className="wizard-progress-bar h-full rounded-full bg-gradient-to-r from-primary via-teal-600 to-sun transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-olive/70">
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-primary">
              {completedStepsCount}
            </span>
            <span>из {steps.length} этапов</span>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {steps.map((item, index) => {
              const isCurrent = activeStep === item.id;
              const statusLabel = isCurrent ? "Текущий" : item.done ? "Готово" : "Ожидает";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchStep(item.id)}
                  className={cn(
                    "group rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                    index === steps.length - 1 && "col-span-2",
                    isCurrent &&
                      "border-sun/50 bg-gradient-to-br from-sun/[0.10] to-sun/[0.04] shadow-[0_10px_18px_-14px_rgba(14,116,144,0.5)] ring-1 ring-sun/20",
                    !isCurrent &&
                      item.done &&
                      "border-primary/20 bg-white/95 hover:border-primary/30 hover:bg-primary/[0.04]",
                    !isCurrent &&
                      !item.done &&
                      "border-olive/12 bg-white/80 hover:border-olive/20 hover:bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-1.5 text-xs font-bold transition-colors",
                        isCurrent
                          ? "bg-sun text-white shadow-sm shadow-sun/30 ring-1 ring-white/80"
                          : item.done
                            ? "bg-primary/10 text-primary/85"
                            : "bg-olive/8 text-olive/60",
                      )}
                    >
                      {item.done && !isCurrent ? (
                        <AppIcon icon={Check} className="h-4 w-4 wizard-check-enter" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        isCurrent ? "text-sun/95" : item.done ? "text-primary/65" : "text-olive/45",
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-sm font-semibold leading-tight",
                      isCurrent ? "font-bold text-olive" : "text-olive/80",
                    )}
                  >
                    {item.title}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="custom-scrollbar hidden overflow-x-auto pb-2 sm:block">
            <div className="mx-auto flex min-w-max items-stretch justify-center gap-2">
              {steps.map((item, index) => {
                const isCurrent = activeStep === item.id;
                const statusLabel = isCurrent ? "Текущий" : item.done ? "Готово" : "Ожидает";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchStep(item.id)}
                    className={cn(
                      "group min-w-[132px] rounded-2xl border px-3 py-3 text-left transition-all duration-200 sm:min-w-[148px]",
                      isCurrent &&
                        "border-sun/50 bg-gradient-to-br from-sun/[0.10] to-sun/[0.04] shadow-[0_10px_18px_-14px_rgba(14,116,144,0.5)] ring-1 ring-sun/20",
                      !isCurrent &&
                        item.done &&
                        "border-primary/20 bg-white/95 hover:border-primary/30 hover:bg-primary/[0.04]",
                      !isCurrent &&
                        !item.done &&
                        "border-olive/12 bg-white/80 hover:border-olive/20 hover:bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold transition-colors",
                          isCurrent
                            ? "bg-sun text-white shadow-sm shadow-sun/30 ring-1 ring-white/80"
                            : item.done
                              ? "bg-primary/10 text-primary/85"
                              : "bg-olive/8 text-olive/60",
                        )}
                      >
                        {item.done && !isCurrent ? (
                          <AppIcon icon={Check} className="h-4 w-4 wizard-check-enter" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          isCurrent
                            ? "text-sun/95"
                            : item.done
                              ? "text-primary/65"
                              : "text-olive/45",
                        )}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-sm font-semibold leading-tight",
                        isCurrent ? "font-bold text-olive" : "text-olive/80",
                      )}
                    >
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {saved && !paymentNoticeText ? (
        <p className="rounded-xl bg-sage/20 px-3 py-2 text-sm text-olive">
          Изменения сохранены. Можно продолжать заполнение или открыть предпросмотр страницы.
        </p>
      ) : null}

      {paymentNoticeText ? (
        <p className="rounded-xl bg-primary/8 px-3 py-2 text-sm text-olive">{paymentNoticeText}</p>
      ) : null}

      {transfer.moderationNotes ? (
        <div className="rounded-2xl bg-terra/10 px-4 py-3 text-sm leading-6 text-olive/85">
          Комментарий модератора: {transfer.moderationNotes}
        </div>
      ) : null}

      <section
        className={cn(
          "wizard-section-enter overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)]",
          activeStep === "info" ? "block" : "hidden",
        )}
      >
        <div className="border-b border-olive/8 bg-white/50 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
              <AppIcon icon={FileText} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-olive">Карточка услуги</h2>
              <p className="mt-0.5 text-sm text-olive/55">
                Название трансфера, основной тип услуги и описание
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="space-y-2">
            <span className="text-sm font-semibold text-olive">1. Название карточки</span>
            <Input
              name="title"
              value={title}
              onChange={(event) => {
                setManualTitle(event.target.value);
                setTitleTouched(true);
              }}
              placeholder="Например: Такси по Ялте"
            />
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-olive">2. Основной тип услуги</span>
            <select
              name="transferType"
              value={transferType}
              onChange={(event) => setTransferType(event.target.value)}
              className="w-full rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none focus:border-primary focus:ring-2 focus:ring-primary/22"
            >
              <option value="">Выберите тип услуги</option>
              {transferTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-olive">3. Описание</span>
              <span className="text-xs tabular-nums text-olive/45">{description.length}/5000</span>
            </div>
            <TextArea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 5000))}
              rows={8}
              placeholder="Опишите, как проходит подача машины, какие есть форматы поездок, чем удобен ваш трансфер, что входит в сервис и в каких случаях к вам обращаются чаще всего."
            />
          </div>

          <div className="hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/8 bg-white/60 px-4 py-3 sm:flex">
            <p className="text-xs text-olive/50">Шаг 1 из 5</p>
            <Button onClick={goToNextStep}>Далее →</Button>
          </div>
        </div>
      </section>

      <section
        className={cn(
          "wizard-section-enter overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)]",
          activeStep === "location" ? "block" : "hidden",
        )}
      >
        <div className="border-b border-olive/8 bg-white/50 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
              <AppIcon icon={MapPin} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-olive">География поездок</h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-olive">1. Город или поселок</span>
            <Input
              name="locationName"
              value={locationName}
              onChange={(event) => {
                setLocationName(event.target.value);
                setSelectedLocationId("");
              }}
              placeholder="Например: Ялта"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-olive">2. Маршруты и примеры поездок</span>
            <TextArea
              name="routeExamples"
              defaultValue={transfer.routeExamples}
              rows={5}
              placeholder="Аэропорт - Ялта, Ялта - Севастополь, трансфер на экскурсии по Южному берегу Крыма"
            />
          </label>

          <div className="rounded-2xl border border-olive/10 bg-white/75 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-olive">3. Метка на карте</p>
                <p className="mt-1 text-xs text-olive/55">
                  Кликните по карте или перетащите точку. Город обновится автоматически.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {latitude !== null && longitude !== null ? "Точка выбрана" : "Необязательно"}
              </span>
            </div>

            <div className="mt-4">
              <YandexMapPicker
                latitude={latitude}
                longitude={longitude}
                onCoordinatesChange={(nextLatitude, nextLongitude) => {
                  setLatitude(nextLatitude);
                  setLongitude(nextLongitude);
                }}
                onAddressResolved={handleMapResolved}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-olive/58">
              {effectiveLocationName ? (
                <span className="rounded-full border border-olive/12 bg-cream/60 px-2.5 py-1">
                  Город: {effectiveLocationName}
                </span>
              ) : null}
              {latitude !== null && longitude !== null ? (
                <span className="rounded-full border border-olive/12 bg-cream/60 px-2.5 py-1">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/8 bg-white/60 px-4 py-3 sm:flex">
            <Button variant="ghost" onClick={goToPreviousStep}>
              ← Назад
            </Button>
            <Button onClick={goToNextStep}>Далее →</Button>
          </div>
        </div>
      </section>

      <section
        className={cn(
          "wizard-section-enter space-y-4 rounded-3xl border border-olive/10 bg-white p-4 shadow-[0_14px_36px_-18px_rgba(58,43,35,0.08)] sm:p-5",
          activeStep === "fleet" ? "block" : "hidden",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <AppIcon icon={Car} className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-olive">Автопарк</h2>
          </div>
        </div>

        <TransferFleetBuilder
          transferId={transfer.id}
          initialFleet={initialFleet}
          initialServiceTags={initialServiceTags}
          onChange={(nextFleet, nextServiceTags) => {
            setFleet(nextFleet);
            setServiceTags(nextServiceTags);
          }}
        />

        <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4 sm:flex">
          <Button variant="ghost" onClick={goToPreviousStep}>
            Назад
          </Button>
          <Button onClick={goToNextStep}>Далее</Button>
        </div>
      </section>

      <section
        className={cn(
          "wizard-section-enter space-y-6 rounded-3xl border border-olive/10 bg-white p-4 shadow-[0_14px_36px_-18px_rgba(58,43,35,0.08)] sm:p-5",
          activeStep === "contacts" ? "block" : "hidden",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <AppIcon icon={Phone} className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-olive">Контакты</h2>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
            Основные данные
          </p>
          <div className="space-y-2.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/45">
                <AppIcon icon={Phone} className="h-4 w-4" />
              </span>
              <Input
                name="contactName"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Имя для связи"
                className="pl-10"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/45">
                <AppIcon icon={Phone} className="h-4 w-4" />
              </span>
              <Input
                name="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 (978) 000-00-00"
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
            Дополнительно
          </p>
          <div className="space-y-2.5">
            {showPhone2 ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-olive/45">
                  <AppIcon icon={Phone} className="h-4 w-4" />
                </span>
                <Input
                  name="phone2"
                  value={phone2}
                  onChange={(event) => setPhone2(event.target.value)}
                  placeholder="Второй телефон"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhone2("");
                    setShowPhone2(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-olive/45 transition hover:text-olive"
                  aria-label="Убрать второй телефон"
                >
                  <AppIcon icon={X} className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {removableField({
              shown: showWebsite,
              onHide: () => {
                setWebsiteUrl("");
                setShowWebsite(false);
              },
              icon: Globe,
              placeholder: "Сайт",
              name: "websiteUrl",
              value: websiteUrl,
              onChange: setWebsiteUrl,
            })}

            {!showPhone2 || !showWebsite ? (
              <div className="flex flex-wrap gap-2">
                {!showPhone2 ? (
                  <button
                    type="button"
                    onClick={() => setShowPhone2(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-3 py-1.5 text-xs font-medium text-olive/60 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <AppIcon icon={Phone} className="h-4 w-4" />
                    Второй телефон
                  </button>
                ) : null}
                {!showWebsite ? (
                  <button
                    type="button"
                    onClick={() => setShowWebsite(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-3 py-1.5 text-xs font-medium text-olive/60 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <AppIcon icon={Globe} className="h-4 w-4" />
                    Сайт
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
            Мессенджеры и соцсети
          </p>
          <div className="space-y-2.5">
            {removableField({
              shown: showWhatsapp,
              onHide: () => {
                setWhatsappUrl("");
                setShowWhatsapp(false);
              },
              brand: "whatsapp",
              placeholder: "WhatsApp: ссылка",
              name: "whatsappUrl",
              value: whatsappUrl,
              onChange: setWhatsappUrl,
            })}
            {removableField({
              shown: showTelegram,
              onHide: () => {
                setTelegramUrl("");
                setShowTelegram(false);
              },
              brand: "telegram",
              placeholder: "Telegram: @username",
              name: "telegramUrl",
              value: telegramUrl,
              onChange: setTelegramUrl,
            })}
            {removableField({
              shown: showVk,
              onHide: () => {
                setVkUrl("");
                setShowVk(false);
              },
              brand: "vk",
              placeholder: "VK: ссылка на профиль",
              name: "vkUrl",
              value: vkUrl,
              onChange: setVkUrl,
            })}
            {removableField({
              shown: showMax,
              onHide: () => {
                setMaxUrl("");
                setShowMax(false);
              },
              brand: "max",
              placeholder: "Max: ссылка на профиль",
              name: "maxUrl",
              value: maxUrl,
              onChange: setMaxUrl,
            })}
            {removableField({
              shown: showOk,
              onHide: () => {
                setOkUrl("");
                setShowOk(false);
              },
              brand: "ok",
              placeholder: "Одноклассники: ссылка",
              name: "okUrl",
              value: okUrl,
              onChange: setOkUrl,
            })}

            {!showWhatsapp || !showTelegram || !showVk || !showMax || !showOk ? (
              <div className="flex flex-wrap gap-2">
                {!showWhatsapp ? (
                  <button
                    type="button"
                    onClick={() => setShowWhatsapp(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#25D366]/35 bg-[#25D366]/5 px-3 py-1.5 text-xs font-medium text-[#25D366] transition hover:border-[#25D366]/60 hover:bg-[#25D366]/10"
                  >
                    <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                    WhatsApp
                  </button>
                ) : null}
                {!showTelegram ? (
                  <button
                    type="button"
                    onClick={() => setShowTelegram(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#2AABEE]/35 bg-[#2AABEE]/5 px-3 py-1.5 text-xs font-medium text-[#2AABEE] transition hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/10"
                  >
                    <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                    Telegram
                  </button>
                ) : null}
                {!showVk ? (
                  <button
                    type="button"
                    onClick={() => setShowVk(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#0077FF]/35 bg-[#0077FF]/5 px-3 py-1.5 text-xs font-medium text-[#0077FF] transition hover:border-[#0077FF]/60 hover:bg-[#0077FF]/10"
                  >
                    <ContactBrandMark brand="vk" bare className="h-4 w-4" />
                    ВКонтакте
                  </button>
                ) : null}
                {!showMax ? (
                  <button
                    type="button"
                    onClick={() => setShowMax(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#FF6600]/35 bg-[#FF6600]/5 px-3 py-1.5 text-xs font-medium text-[#FF6600] transition hover:border-[#FF6600]/60 hover:bg-[#FF6600]/10"
                  >
                    <ContactBrandMark brand="max" bare className="h-4 w-4" />
                    Max
                  </button>
                ) : null}
                {!showOk ? (
                  <button
                    type="button"
                    onClick={() => setShowOk(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#EE8208]/35 bg-[#EE8208]/5 px-3 py-1.5 text-xs font-medium text-[#EE8208] transition hover:border-[#EE8208]/60 hover:bg-[#EE8208]/10"
                  >
                    <ContactBrandMark brand="ok" bare className="h-4 w-4" />
                    Одноклассники
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4 sm:flex">
          <Button variant="ghost" onClick={goToPreviousStep}>
            Назад
          </Button>
          <Button onClick={goToNextStep}>Далее</Button>
        </div>
      </section>

      <section
        className={cn(
          "wizard-section-enter space-y-4 rounded-3xl border border-olive/10 bg-white p-4 shadow-[0_14px_36px_-18px_rgba(58,43,35,0.08)] sm:p-5",
          activeStep === "publish" ? "block" : "hidden",
        )}
      >
        <section className="overflow-hidden rounded-2xl border border-olive/10 bg-white shadow-sm">
          <div className="border-b border-olive/8 bg-cream/60 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-olive">Оплата размещения</h2>
                <p className="mt-0.5 text-sm text-olive/55">
                  Последний шаг перед публикацией трансфера
                </p>
                <p className="mt-0.5 text-xs text-olive/45">
                  <span className="font-medium text-olive/60">{displayTitle}</span>
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  statusMeta.bg,
                  statusMeta.text,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                {statusMeta.label}
              </span>
            </div>

            <p className={cn("mt-3 text-sm", publishReady ? "text-emerald-700" : "text-olive/70")}>
              <span className="flex items-center gap-1.5">
                <AppIcon
                  icon={publishReady ? CircleCheckBig : CircleAlert}
                  className={cn("h-4 w-4", publishReady ? "text-emerald-500" : "text-amber-500")}
                />
                {paymentReadinessHint}
              </span>
            </p>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl border border-olive/10 bg-cream/70 p-4 text-sm text-olive/75">
              <p className="mb-2 font-semibold text-olive">Как это работает?</p>
              <ol className="list-inside list-decimal space-y-1.5 text-[13px]">
                <li>Проверьте, что карточка, география, автопарк и контакты заполнены.</li>
                <li>Выберите онлайн-оплату или заявку менеджеру.</li>
                <li>После подтверждения оплаты карточка уйдет на модерацию автоматически.</li>
                <li>После модерации трансфер появится в каталоге.</li>
              </ol>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-cream p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-olive/50">
                  Город работы
                </p>
                <p className="mt-1.5 text-base font-semibold leading-tight text-olive">
                  {effectiveLocationName || "Не указан"}
                </p>
                <p className="mt-1 text-[11px] text-olive/50">
                  Показывается в каталоге и поиске
                </p>
              </div>
              <div className="rounded-xl bg-cream p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-olive/50">
                  Автопарк
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-base font-semibold leading-tight",
                    fleet.length > 0 ? "text-olive" : "text-olive/45",
                  )}
                >
                  {fleet.length > 0 ? `${fleet.length} вариантов` : "Пока пусто"}
                </p>
                <p className="mt-1 text-[11px] text-olive/50">
                  Фото, транспорт и цены обязательны
                </p>
              </div>
              <div className="rounded-xl bg-cream p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-olive/50">
                  Цена в карточке
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-base font-semibold leading-tight",
                    fleetSummary.priceFrom ? "text-olive" : "text-olive/45",
                  )}
                >
                  {fleetSummary.priceFrom
                    ? `${Number(fleetSummary.priceFrom).toLocaleString("ru-RU")} ₽${fleetSummary.priceUnitLabel ?? ""}`
                    : "Не указана"}
                </p>
                <p className="mt-1 text-[11px] text-olive/50">
                  Минимальная цена из автопарка
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-3 text-sm font-semibold text-olive">Счет к оплате</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-olive/65">Услуга</span>
                  <span className="text-right font-medium text-olive">
                    Публикация карточки трансфера
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-olive/65">Срок размещения</span>
                  <span className="text-right font-medium text-olive">
                    {TRANSFER_PAYMENT_VALIDITY_DAYS} дней
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-olive/65">Карточка</span>
                  <span className="text-right font-medium text-olive">{displayTitle}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-primary/15 pt-3">
                  <span className="font-semibold text-olive">Итого</span>
                  <span className="text-2xl font-bold tabular-nums text-olive">
                    {formatMoney(publicationFeeRub)}
                  </span>
                </div>
              </div>
            </div>

            {paidUntil ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <AppIcon icon={CalendarDays} className="h-4 w-4 shrink-0" />
                <span>
                  Размещение оплачено до <strong>{formatDate(paidUntil)}</strong>
                </span>
              </div>
            ) : null}

            {!publishReady ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-red-800">
                  <AppIcon icon={CircleAlert} className="h-4 w-4" />
                  Что нужно сделать перед оплатой
                </p>
                <p className="mb-3 text-xs text-red-600/70">
                  Перейдите в нужные шаги, заполните данные и вернитесь к оплате.
                </p>
                <ul className="space-y-2">
                  {readinessIssues.length > 0 ? (
                    readinessIssues.map((issue) => (
                      <li key={issue.label} className="flex items-start justify-between gap-3">
                        <span>{issue.label}</span>
                        <button
                          type="button"
                          onClick={() => switchStep(issue.step)}
                          className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                        >
                          Исправить
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>Проверьте фото, цену, контакты и описание карточки.</li>
                  )}
                </ul>
              </div>
            ) : null}

            {alreadyOnModeration ? (
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-primary">
                <p className="font-semibold">
                  {transfer.status === "PUBLISHED"
                    ? "Карточка уже опубликована."
                    : "Карточка сейчас на модерации."}
                </p>
                <p className="mt-1 text-primary/75">
                  Когда статус изменится, он обновится в личном кабинете.
                </p>
              </div>
            ) : null}

            {hasSucceededPayment && !alreadyOnModeration ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <p className="font-semibold">Оплата подтверждена</p>
                <p className="mt-1">
                  Повторная оплата не нужна. Нажмите «Отправить на модерацию», чтобы продолжить.
                </p>
              </div>
            ) : null}

            {managerPaymentPending ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <AppIcon icon={CircleCheckBig} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold text-olive">Заявка на оплату отправлена</p>
                    <p className="mt-1 text-sm text-olive/70">
                      Менеджер свяжется с вами и подтвердит оплату. После подтверждения карточка
                      автоматически уйдет на модерацию.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {canCreatePayment ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-olive">Выберите способ оплаты</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentProvider("MANAGER")}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition",
                      paymentProvider === "MANAGER"
                        ? "border-primary bg-primary/5"
                        : "border-olive/15 bg-white hover:border-olive/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        paymentProvider === "MANAGER" ? "bg-primary/15" : "bg-olive/8",
                      )}
                    >
                      <AppIcon
                        icon={Phone}
                        className={cn(
                          "h-5 w-5",
                          paymentProvider === "MANAGER" ? "text-primary" : "text-olive/50",
                        )}
                      />
                    </span>
                    <span>
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          paymentProvider === "MANAGER" ? "text-primary" : "text-olive",
                        )}
                      >
                        Через менеджера
                      </span>
                      <span className="mt-0.5 block text-xs text-olive/55">
                        Перевод на карту или по реквизитам
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentProvider("YOOKASSA")}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition",
                      paymentProvider === "YOOKASSA"
                        ? "border-primary bg-primary/5"
                        : "border-olive/15 bg-white hover:border-olive/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        paymentProvider === "YOOKASSA" ? "bg-primary/15" : "bg-olive/8",
                      )}
                    >
                      <AppIcon
                        icon={CreditCard}
                        className={cn(
                          "h-5 w-5",
                          paymentProvider === "YOOKASSA" ? "text-primary" : "text-olive/50",
                        )}
                      />
                    </span>
                    <span>
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          paymentProvider === "YOOKASSA" ? "text-primary" : "text-olive",
                        )}
                      >
                        Онлайн-оплата
                      </span>
                      <span className="mt-0.5 block text-xs text-olive/55">
                        Банковская карта через YooKassa
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {yookassaPaymentUrl ? (
                <Button
                  type="submit"
                  name="intent"
                  value="submit"
                  disabled={!publishReady}
                  className="gap-2"
                >
                  <AppIcon icon={CreditCard} className="h-4 w-4" />
                  Продолжить оплату
                </Button>
              ) : !managerPaymentPending && !alreadyOnModeration ? (
                <Button
                  type="submit"
                  name="intent"
                  value="submit"
                  disabled={!canUsePrimaryPaymentSubmit}
                >
                  {primaryPaymentLabel}
                </Button>
              ) : null}

              {latestPayment?.provider === "YOOKASSA" && latestPaymentIsOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void refreshLatestPaymentStatus()}
                  disabled={isRefreshingPayment}
                  className="gap-2"
                >
                  <AppIcon icon={RefreshCw} className="h-4 w-4" />
                  {isRefreshingPayment ? "Проверяем..." : "Проверить статус"}
                </Button>
              ) : null}

              <Button type="submit" name="intent" value="preview" variant="ghost">
                Предпросмотр
              </Button>

              <Button type="button" variant="ghost" onClick={goToPreviousStep}>
                Назад
              </Button>
            </div>
          </div>
        </section>

        {latestPayment ? (
          <section className="rounded-2xl border border-olive/10 bg-white p-4">
            <h3 className="text-lg font-semibold text-olive">Последний платеж</h3>
            <div className="mt-2 grid gap-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-olive/55">Статус</span>
                <span className="font-semibold text-olive">{latestPayment.statusLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-olive/55">Сумма</span>
                <span className="font-semibold text-olive">
                  {formatMoney(latestPayment.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-olive/55">Способ</span>
                <span className="text-olive">{getPaymentProviderLabel(latestPayment.provider)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-olive/55">Дата</span>
                <span className="text-olive">{formatDateTime(latestPayment.createdAt)}</span>
              </div>
            </div>

            {latestPaymentIsOpen ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {latestPayment.provider === "MANAGER" ? (
                  <div className="w-full rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-medium">Ожидает подтверждения менеджером</p>
                    <p className="mt-0.5 text-xs text-amber-700/70">
                      После подтверждения карточка будет отправлена на модерацию автоматически.
                    </p>
                  </div>
                ) : null}

                {latestPayment.provider === "YOOKASSA" && latestPayment.confirmationUrl ? (
                  <a
                    href={latestPayment.confirmationUrl}
                    className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                  >
                    Открыть YooKassa
                  </a>
                ) : null}
              </div>
            ) : null}

            {latestPayment.status === "SUCCEEDED" ? (
              <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-700">
                Оплата подтверждена.
              </div>
            ) : null}

            {latestPayment.status === "CANCELED" ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AppIcon icon={CircleX} className="mt-0.5 h-4 w-4 shrink-0" />
                Платеж отменен или не прошел. Можно повторить оплату.
              </div>
            ) : null}
          </section>
        ) : null}

        {payments.length > 0 ? (
          <section className="rounded-2xl border border-olive/10 bg-white p-4">
            <h3 className="text-lg font-semibold text-olive">История платежей</h3>
            <p className="mt-0.5 text-xs text-olive/50">
              Все операции по оплате публикации трансфера
            </p>

            <div className="mt-3 space-y-2 sm:hidden">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-xl border border-olive/10 bg-cream/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-olive">
                      {formatMoney(payment.amount)}
                    </span>
                    <span className="rounded-full bg-olive/8 px-2 py-0.5 text-[11px] font-semibold text-olive/70">
                      {payment.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-olive/55">
                    {getTransferPaymentTariffLabel(payment.tariffCode)}
                  </p>
                  <p className="text-xs text-olive/45">{formatDateTime(payment.createdAt)}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 hidden overflow-x-auto sm:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-olive/65">
                    <th className="py-1.5 pr-4 text-xs font-semibold uppercase tracking-wide">
                      Тариф
                    </th>
                    <th className="py-1.5 pr-4 text-xs font-semibold uppercase tracking-wide">
                      Сумма
                    </th>
                    <th className="py-1.5 pr-4 text-xs font-semibold uppercase tracking-wide">
                      Статус
                    </th>
                    <th className="py-1.5 pr-4 text-xs font-semibold uppercase tracking-wide">
                      Способ
                    </th>
                    <th className="py-1.5 text-xs font-semibold uppercase tracking-wide">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-olive/10">
                      <td className="py-2 pr-4 text-olive">
                        {getTransferPaymentTariffLabel(payment.tariffCode)}
                      </td>
                      <td className="py-2 pr-4 font-medium text-olive">
                        {formatMoney(payment.amount)}
                      </td>
                      <td className="py-2 pr-4 text-olive">{payment.statusLabel}</td>
                      <td className="py-2 pr-4 text-olive">
                        {getPaymentProviderLabel(payment.provider)}
                      </td>
                      <td className="py-2 text-olive">{formatDateTime(payment.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {paymentError ? (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0" />
            {paymentError}
          </div>
        ) : null}

        {paymentMessage ? (
          <div className="flex items-start gap-2 rounded-xl bg-primary/8 p-3 text-sm text-primary">
            <AppIcon icon={CircleCheckBig} className="mt-0.5 h-4 w-4 shrink-0" />
            {paymentMessage}
          </div>
        ) : null}
      </section>

      <div className="sticky-bottom-enter sticky bottom-0 z-30 -mx-4 border-t border-olive/10 glass-mobile-bar px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/45">
              Шаг {activeStepIndex + 1} из {steps.length}
            </p>
            <p className="truncate text-sm font-semibold text-olive">{activeStepTitle}</p>
          </div>
          <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {completedStepsCount}/{steps.length}
          </span>
        </div>

        {activeStep === "publish" ? (
          <div className="mt-3 space-y-2">
            <div className={cn("grid gap-2", previousStep ? "grid-cols-2" : "grid-cols-1")}>
              {previousStep ? (
                <Button variant="ghost" onClick={goToPreviousStep} className="min-h-11 w-full">
                  Назад
                </Button>
              ) : null}
              <Button
                type="submit"
                name="intent"
                value="preview"
                variant="ghost"
                className="min-h-11 w-full"
              >
                Предпросмотр
              </Button>
            </div>
            {yookassaPaymentUrl ? (
              <Button
                type="submit"
                name="intent"
                value="submit"
                disabled={!publishReady}
                className="min-h-11 w-full"
              >
                Продолжить оплату
              </Button>
            ) : !managerPaymentPending && !alreadyOnModeration ? (
              <Button
                type="submit"
                name="intent"
                value="submit"
                disabled={!canUsePrimaryPaymentSubmit}
                className="min-h-11 w-full"
              >
                {primaryPaymentLabel}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={cn("mt-3 grid gap-2", previousStep ? "grid-cols-2" : "grid-cols-1")}>
            {previousStep ? (
              <Button variant="ghost" onClick={goToPreviousStep} className="min-h-11 w-full">
                Назад
              </Button>
            ) : null}
            <Button onClick={goToNextStep} className="min-h-11 w-full">
              Далее
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
