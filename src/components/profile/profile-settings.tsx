"use client";

import {
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  Eye,
  EyeOff,
  Heart,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { imageSizeLimitBytes } from "@/lib/constants";
import { AvatarCropEditor, type CropParams } from "@/components/profile/avatar-crop-editor";

// ── SVG icons ──────────────────────────────────────────────────────────────────

function CameraIcon({ className }: { className?: string }) {
  return <AppIcon icon={Camera} className={className} />;
}

function UserIcon({ className }: { className?: string }) {
  return <AppIcon icon={UserRound} className={className} />;
}

function HeartIcon({ className }: { className?: string }) {
  return <AppIcon icon={Heart} className={className} />;
}

function ReviewsIcon({ className }: { className?: string }) {
  return <AppIcon icon={MessageSquareText} className={className} />;
}

function PenIcon({ className }: { className?: string }) {
  return <AppIcon icon={PenLine} className={className} />;
}

function ShieldIcon({ className }: { className?: string }) {
  return <AppIcon icon={ShieldCheck} className={className} />;
}

function ShieldXIcon({ className }: { className?: string }) {
  return <AppIcon icon={ShieldX} className={className} />;
}

function CalendarIcon({ className }: { className?: string }) {
  return <AppIcon icon={CalendarDays} className={className} />;
}

function SparklesIcon({ className }: { className?: string }) {
  return <AppIcon icon={Sparkles} className={className} />;
}

function LockIcon({ className }: { className?: string }) {
  return <AppIcon icon={LockKeyhole} className={className} />;
}

function LogoutIcon({ className }: { className?: string }) {
  return <AppIcon icon={LogOut} className={className} />;
}

function EyeIcon() {
  return <AppIcon icon={Eye} className="h-4 w-4" />;
}

function EyeOffIcon() {
  return <AppIcon icon={EyeOff} className="h-4 w-4" />;
}

function CheckIcon({ className }: { className?: string }) {
  return <AppIcon icon={CircleCheckBig} className={className} />;
}

function AlertCircleIcon({ className }: { className?: string }) {
  return <AppIcon icon={CircleAlert} className={className} />;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return <AppIcon icon={ChevronDown} className={className} />;
}

function ChevronUpIcon({ className }: { className?: string }) {
  return <AppIcon icon={ChevronUp} className={className} />;
}

// ── Status message ─────────────────────────────────────────────────────────────

function StatusMessage({ type, message }: { type: "error" | "success"; message: string }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={`mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${
        isError
          ? "bg-red-50 text-red-700 ring-1 ring-red-200/80"
          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
      }`}
    >
      {isError ? (
        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

function AvailabilityNotice({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200/80">
      {message}
    </div>
  );
}

type ProfileItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneVerifiedAt: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProfileSettingsProps = {
  initialProfile: ProfileItem;
  favoriteCount?: number;
  reviewCount?: number;
  passwordChangeAvailable?: boolean;
  passwordChangeUnavailableReason?: string | null;
};

const avatarCanvasSize = 640;
const avatarMinimumSourceSide = 256;

type SupportedAvatarUploadType = "jpeg" | "png" | "heic" | "heif" | "webp";

function normalizeMimeType(value: string): string {
  return value.toLowerCase().split(";")[0]?.trim() ?? "";
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName
    .slice(lastDot + 1)
    .toLowerCase()
    .trim();
}

function detectSupportedAvatarUploadType(file: File): SupportedAvatarUploadType | null {
  const mime = normalizeMimeType(file.type);
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  if (mime === "image/webp") return "webp";

  const ext = getFileExtension(file.name);
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "heic") return "heic";
  if (ext === "heif") return "heif";
  if (ext === "webp") return "webp";
  return null;
}

function getInitials(input: { firstName: string }): string {
  const first = input.firstName.trim().slice(0, 1);
  return (first || "?").toUpperCase();
}

function formatPhoneForInput(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return "";

  const normalized =
    digits.length === 10
      ? `7${digits}`
      : digits.length === 11 && digits.startsWith("8")
        ? `7${digits.slice(1)}`
        : digits;

  if (normalized.length === 11 && normalized.startsWith("7")) {
    const area = normalized.slice(1, 4);
    const prefix = normalized.slice(4, 7);
    const part1 = normalized.slice(7, 9);
    const part2 = normalized.slice(9, 11);

    let formatted = "+7";
    if (area) {
      formatted += ` (${area}`;
      if (area.length === 3) {
        formatted += ")";
      }
    }
    if (prefix) {
      formatted += area.length === 3 ? ` ${prefix}` : prefix;
    }
    if (part1) {
      formatted += `-${part1}`;
    }
    if (part2) {
      formatted += `-${part2}`;
    }
    return formatted;
  }

  return `+${normalized}`;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    image.src = url;
  });
}

async function readImageMetaFromFile(file: File): Promise<{
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(imageUrl);
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("Некорректный размер изображения");
    }
    return { imageUrl, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(imageUrl);
    throw error;
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/webp", quality));
}

async function createCroppedAvatarFile(input: {
  imageUrl: string;
  fileName: string;
  naturalWidth: number;
  naturalHeight: number;
  imageX: number;
  imageY: number;
  imageSize: number;
  rotation: 0 | 90 | 180 | 270;
}): Promise<File> {
  const { naturalWidth: nw, naturalHeight: nh, rotation, imageX, imageY, imageSize } = input;
  const image = await loadImageFromUrl(input.imageUrl);

  const rotW = rotation % 180 !== 0 ? nh : nw;
  const rotH = rotation % 180 !== 0 ? nw : nh;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = rotW;
  tempCanvas.height = rotH;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("Не удалось подготовить изображение к загрузке");
  tempCtx.translate(rotW / 2, rotH / 2);
  tempCtx.rotate((rotation * Math.PI) / 180);
  tempCtx.drawImage(image, -nw / 2, -nh / 2, nw, nh);

  const canvas = document.createElement("canvas");
  canvas.width = avatarCanvasSize;
  canvas.height = avatarCanvasSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось подготовить изображение к загрузке");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    tempCanvas,
    Math.round(imageX),
    Math.round(imageY),
    Math.round(imageSize),
    Math.round(imageSize),
    0,
    0,
    avatarCanvasSize,
    avatarCanvasSize,
  );

  let blob = await canvasToWebpBlob(canvas, 0.9);
  if (!blob) blob = await canvasToJpegBlob(canvas, 0.9);
  if (blob && blob.size > imageSizeLimitBytes) {
    blob = await canvasToWebpBlob(canvas, 0.8);
    if (!blob) blob = await canvasToJpegBlob(canvas, 0.82);
  }
  if (!blob) throw new Error("Не удалось сохранить обрезанный файл");
  if (blob.size > imageSizeLimitBytes) {
    throw new Error(
      "Фотография превышает допустимый размер. Зайдите на сайт для сжатия фотографий, сожмите файл и загрузите его сюда повторно",
    );
  }

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const baseName = input.fileName.replace(/\.[^/.]+$/, "") || "avatar";
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}

type CropEditorState = {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  fileName: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ProfileSettings({
  initialProfile,
  favoriteCount = 0,
  reviewCount = 0,
  passwordChangeAvailable = true,
  passwordChangeUnavailableReason = null,
}: ProfileSettingsProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileItem>(initialProfile);
  const [profileForm, setProfileForm] = useState({
    firstName: initialProfile.firstName,
    lastName: initialProfile.lastName,
    phone: formatPhoneForInput(initialProfile.phone),
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(true);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [cropEditor, setCropEditor] = useState<CropEditorState | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = useMemo(
    () => getInitials({ firstName: profile.firstName }),
    [profile.firstName],
  );
  const isPasswordSectionDisabled = !passwordChangeAvailable;
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "Пользователь";
  const memberSince = Number.isNaN(new Date(profile.createdAt).getTime())
    ? "2025"
    : String(new Date(profile.createdAt).getFullYear());
  const isPhoneVerified = Boolean(profile.phoneVerifiedAt);

  async function saveProfile() {
    setProfileError("");
    setProfileSuccess("");

    const formattedPhone = formatPhoneForInput(profileForm.phone);
    const phoneDigits = formattedPhone.replace(/\D/g, "");

    if (!phoneDigits) {
      setProfileError("Введите номер телефона");
      return;
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setProfileError("Введите корректный номер телефона");
      return;
    }

    setIsProfileSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileForm,
          phone: formattedPhone,
        }),
      });
      const body = (await response.json()) as { error?: string; item?: ProfileItem };
      if (!response.ok || !body.item) {
        setProfileError(body.error ?? "Не удалось сохранить профиль");
        return;
      }
      setProfile(body.item);
      setProfileForm({
        firstName: body.item.firstName,
        lastName: body.item.lastName,
        phone: formatPhoneForInput(body.item.phone),
      });
      setProfileSuccess("Профиль сохранен.");
      router.refresh();
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function savePassword() {
    setPasswordError("");
    setPasswordSuccess("");
    if (isPasswordSectionDisabled) {
      setPasswordError(passwordChangeUnavailableReason ?? "Смена пароля временно недоступна.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Новые пароли не совпадают.");
      return;
    }
    setIsPasswordSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setPasswordError(body.error ?? "Не удалось изменить пароль");
        return;
      }
      setPasswordSuccess("Пароль успешно изменен.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } finally {
      setIsPasswordSaving(false);
    }
  }

  async function uploadAvatar(file: File): Promise<boolean> {
    setAvatarError("");
    setAvatarSuccess("");
    setIsAvatarSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const body = (await response.json()) as {
        error?: string;
        item?: { avatarUrl: string | null };
      };
      if (!response.ok || !body.item) {
        setAvatarError(body.error ?? "Не удалось загрузить фото");
        return false;
      }
      setProfile((prev) => ({ ...prev, avatarUrl: body.item?.avatarUrl ?? null }));
      setAvatarSuccess("Фото профиля обновлено.");
      router.refresh();
      return true;
    } finally {
      setIsAvatarSaving(false);
    }
  }

  async function handleFileSelect(file: File) {
    setAvatarError("");
    setAvatarSuccess("");

    const uploadType = detectSupportedAvatarUploadType(file);
    if (!uploadType) {
      setAvatarError("Поддерживаются PNG, JPEG, WEBP и HEIC");
      return;
    }
    if (file.size > imageSizeLimitBytes) {
      setAvatarError(
        "Фотография превышает допустимый размер. Зайдите на сайт для сжатия фотографий, сожмите файл и загрузите его сюда повторно",
      );
      return;
    }

    setIsAvatarProcessing(true);
    try {
      const meta = await readImageMetaFromFile(file);
      if (
        meta.naturalWidth < avatarMinimumSourceSide ||
        meta.naturalHeight < avatarMinimumSourceSide
      ) {
        URL.revokeObjectURL(meta.imageUrl);
        setAvatarError(
          `Минимальный размер фото: ${avatarMinimumSourceSide} × ${avatarMinimumSourceSide} пикселей.`,
        );
        return;
      }
      setCropEditor({
        imageUrl: meta.imageUrl,
        naturalWidth: meta.naturalWidth,
        naturalHeight: meta.naturalHeight,
        fileName: file.name || "avatar",
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Не удалось прочитать фото");
    } finally {
      setIsAvatarProcessing(false);
    }
  }

  async function handleCropConfirm(params: CropParams) {
    if (!cropEditor) return;
    const { imageUrl, fileName, naturalWidth, naturalHeight } = cropEditor;
    setCropEditor(null);
    setIsAvatarProcessing(true);
    try {
      const croppedFile = await createCroppedAvatarFile({
        imageUrl,
        fileName,
        naturalWidth,
        naturalHeight,
        imageX: params.imageX,
        imageY: params.imageY,
        imageSize: params.imageSize,
        rotation: params.rotation,
      });
      await uploadAvatar(croppedFile);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Не удалось обработать фото");
    } finally {
      URL.revokeObjectURL(imageUrl);
      setIsAvatarProcessing(false);
    }
  }

  function handleCropCancel() {
    if (cropEditor) URL.revokeObjectURL(cropEditor.imageUrl);
    setCropEditor(null);
  }

  async function removeAvatar() {
    setAvatarError("");
    setAvatarSuccess("");
    setIsAvatarSaving(true);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const body = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setAvatarError(body.error ?? "Не удалось удалить фото");
        return;
      }
      setProfile((prev) => ({ ...prev, avatarUrl: null }));
      setAvatarSuccess("Фото профиля удалено.");
      router.refresh();
    } finally {
      setIsAvatarSaving(false);
    }
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  const isBusy = isAvatarSaving || isAvatarProcessing;

  return (
    <>
      {/* Crop editor modal */}
      {cropEditor && (
        <AvatarCropEditor
          imageUrl={cropEditor.imageUrl}
          naturalWidth={cropEditor.naturalWidth}
          naturalHeight={cropEditor.naturalHeight}
          onConfirm={(params) => void handleCropConfirm(params)}
          onCancel={handleCropCancel}
        />
      )}

      <div className="dashboard-profile-page overflow-hidden rounded-[26px] bg-white/94 p-3 shadow-[0_28px_80px_rgba(58,43,35,0.1)] ring-1 ring-white/80 backdrop-blur-xl md:p-4">
        <section className="dashboard-profile-hero relative overflow-hidden rounded-[22px] px-5 py-6 md:px-10 md:py-8">
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative mx-auto h-36 w-36 shrink-0 sm:mx-0 md:h-44 md:w-44">
                <div
                  className={cn(
                    "h-full w-full overflow-hidden rounded-full bg-cream ring-[7px] ring-white shadow-[0_18px_42px_rgba(58,43,35,0.18)] transition",
                    profile.avatarUrl ? "bg-white" : "bg-[linear-gradient(180deg,#fff7df,#d7f3ee)]",
                  )}
                >
                  <AvatarImage
                    src={profile.avatarUrl}
                    alt="Фото профиля"
                    className="h-full w-full object-cover"
                  >
                    <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-primary/72">
                      {initials}
                    </div>
                  </AvatarImage>
                </div>
                <label
                  className={cn(
                    "absolute -bottom-1 -right-1 inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white text-primary shadow-[0_12px_26px_rgba(58,43,35,0.18)] ring-1 ring-olive/8 transition hover:text-primary-hover",
                    isBusy && "cursor-not-allowed opacity-65",
                  )}
                  title="Изменить фото"
                >
                  <CameraIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                    className="hidden"
                    disabled={isBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFileSelect(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <h1 className="font-heading text-3xl font-semibold leading-tight text-olive md:text-4xl">
                  {displayName}
                </h1>
                <p className="mt-2 text-sm text-olive/74 md:text-base">
                  Путешественник <span className="px-1.5 text-olive/35">·</span> Крым вокруг
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm text-olive/80 sm:justify-start">
                  <span className="inline-flex items-center gap-2">
                    {isPhoneVerified ? (
                      <ShieldIcon className="h-5 w-5 text-primary" />
                    ) : (
                      <ShieldXIcon className="h-5 w-5 text-red-600" />
                    )}
                    {isPhoneVerified ? "Телефон подтверждён" : "Телефон не подтверждён"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    Участник с {memberSince}
                  </span>
                </div>
                <StatusMessage type="error" message={avatarError} />
                <StatusMessage type="success" message={avatarSuccess} />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <label
                className={cn(
                  "inline-flex h-14 cursor-pointer items-center justify-center gap-3 rounded-xl border border-white/80 bg-white/82 px-6 text-sm font-bold text-primary shadow-[0_14px_34px_rgba(15,118,110,0.12)] backdrop-blur transition hover:bg-white",
                  isBusy && "cursor-not-allowed opacity-65",
                )}
              >
                <CameraIcon className="h-5 w-5" />
                {isBusy ? "Обработка..." : "Изменить фото"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                  className="hidden"
                  disabled={isBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFileSelect(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <a
                href="#personal"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-[0_18px_40px_rgba(15,118,110,0.28)] transition hover:bg-primary-hover"
              >
                <PenIcon className="h-5 w-5" />
                Редактировать профиль
              </a>
              {profile.avatarUrl ? (
                <Button
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => void removeAvatar()}
                  className="h-14 border-white/80 bg-white/70 px-5 text-primary hover:bg-white hover:text-primary-hover"
                >
                  Удалить фото
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <section className="rounded-[16px] bg-white/88 p-5 ring-1 ring-olive/10">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <HeartIcon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-olive">Избранное</p>
                <p className="mt-0.5 text-3xl font-bold leading-none text-primary">{favoriteCount}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.08em] text-olive/45">
                  сохранённых мест
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-[16px] bg-white/88 p-5 ring-1 ring-olive/10">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <ReviewsIcon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-olive">Отзывы</p>
                <p className="mt-0.5 text-3xl font-bold leading-none text-primary">{reviewCount}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.08em] text-olive/45">
                  оставлено отзывов
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[0.92fr_1fr]">
          <div className="grid gap-3">
            <section
              id="personal"
              className="scroll-mt-32 rounded-[16px] bg-white/90 p-5 ring-1 ring-olive/10 md:p-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <UserIcon className="h-5 w-5" />
                </div>
                <h2 className="font-heading text-2xl font-semibold text-olive">Личные данные</h2>
              </div>
              <div className="grid gap-3">
                <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                  <span className="text-sm font-medium text-olive">Имя</span>
                  <Input
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    className="h-10 rounded-lg bg-white/90 py-2 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]"
                  />
                </label>
                <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                  <span className="text-sm font-medium text-olive">Фамилия</span>
                  <Input
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    className="h-10 rounded-lg bg-white/90 py-2 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]"
                  />
                </label>
                <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                  <span className="text-sm font-medium text-olive">Телефон</span>
                  <span className="relative block">
                    <Input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+7 (___) ___-__-__"
                      required
                      value={profileForm.phone}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          phone: formatPhoneForInput(event.target.value),
                        }))
                      }
                      className="h-10 rounded-lg bg-white/90 py-2 pr-10 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]"
                    />
                    <span
                      className={cn(
                        "absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-white",
                        isPhoneVerified ? "bg-primary" : "bg-red-600",
                      )}
                      title={isPhoneVerified ? "Телефон подтверждён" : "Телефон не подтверждён"}
                    >
                      {isPhoneVerified ? (
                        <CheckIcon className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldXIcon className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </span>
                </label>
                <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                  <span className="text-sm font-medium text-olive">Email</span>
                  <Input
                    value={profile.email ?? ""}
                    placeholder="Email не указан"
                    readOnly
                    className="h-10 rounded-lg bg-white/72 py-2 text-olive/72 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]"
                  />
                </label>
              </div>
              <Button
                onClick={() => void saveProfile()}
                disabled={isProfileSaving}
                className="mt-5 h-11 w-full rounded-lg bg-primary shadow-[0_14px_30px_rgba(15,118,110,0.22)] hover:bg-primary-hover"
              >
                {isProfileSaving ? "Сохранение..." : "Сохранить изменения"}
              </Button>
              <StatusMessage type="error" message={profileError} />
              <StatusMessage type="success" message={profileSuccess} />
            </section>

            <section className="rounded-[16px] bg-white/90 p-5 ring-1 ring-olive/10 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <h2 className="font-heading text-2xl font-semibold text-olive">
                  Предпочтения поездок
                </h2>
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-[110px_1fr] sm:items-center">
                <span className="font-medium text-olive">Тип отдыха</span>
                <div className="flex flex-wrap gap-2">
                  {["Экскурсии", "Природа", "Пляжный отдых"].map((item, index) => (
                    <span
                      key={item}
                      className={cn(
                        "rounded-full px-4 py-2 font-semibold",
                        index === 0 ? "bg-primary text-white" : "bg-primary/10 text-primary",
                      )}
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <span className="font-medium text-olive">Транспорт</span>
                <div className="flex flex-wrap gap-2">
                  {["Авто", "Пешком", "Общественный транспорт"].map((item, index) => (
                    <span
                      key={item}
                      className={cn(
                        "rounded-full px-4 py-2 font-semibold",
                        index === 0 ? "bg-primary text-white" : "bg-olive/8 text-olive/78",
                      )}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section
            id="password"
            className="scroll-mt-32 rounded-[16px] bg-white/90 p-5 ring-1 ring-olive/10 md:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <LockIcon className="h-5 w-5" />
                </div>
                <h2 className="font-heading text-2xl font-semibold text-olive">
                  Безопасность аккаунта
                </h2>
              </div>
              <button
                type="button"
                aria-expanded={isPasswordSectionOpen}
                onClick={() => setIsPasswordSectionOpen((value) => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary transition hover:bg-primary/8"
                title={isPasswordSectionOpen ? "Скрыть" : "Открыть"}
              >
                {isPasswordSectionOpen ? (
                  <ChevronUpIcon className="h-5 w-5" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            {isPasswordSectionOpen ? (
              <div
                className={cn(
                  "rounded-[18px] bg-white/56 p-4 ring-1 ring-olive/10 md:p-5",
                  isPasswordSectionDisabled && "opacity-70",
                )}
              >
                <h3 className="font-semibold text-olive">Изменение пароля</h3>
                <p className="mt-1 text-sm text-olive/58">
                  Рекомендуем регулярно обновлять пароль для защиты вашего аккаунта.
                </p>
                <AvailabilityNotice
                  message={isPasswordSectionDisabled ? passwordChangeUnavailableReason : null}
                />
                <div className="mt-5 grid gap-3">
                  <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                    <span className="text-sm font-medium text-olive">Текущий пароль</span>
                    <span className="relative block">
                      <Input
                        type={showCurrent ? "text" : "password"}
                        autoComplete="current-password"
                        value={passwordForm.currentPassword}
                        disabled={isPasswordSectionDisabled}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            currentPassword: event.target.value,
                          }))
                        }
                        className={cn(
                          "h-10 rounded-lg bg-white/90 py-2 pr-10 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]",
                          isPasswordSectionDisabled && "cursor-not-allowed bg-cream text-olive/60",
                        )}
                      />
                      <button
                        type="button"
                        disabled={isPasswordSectionDisabled}
                        onClick={() => setShowCurrent((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-olive/40 hover:text-olive/70 disabled:cursor-not-allowed disabled:opacity-50"
                        title={showCurrent ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </span>
                  </label>
                  <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                    <span className="text-sm font-medium text-olive">Новый пароль</span>
                    <span className="relative block">
                      <Input
                        type={showNew ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        disabled={isPasswordSectionDisabled}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                        }
                        className={cn(
                          "h-10 rounded-lg bg-white/90 py-2 pr-10 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]",
                          isPasswordSectionDisabled && "cursor-not-allowed bg-cream text-olive/60",
                        )}
                      />
                      <button
                        type="button"
                        disabled={isPasswordSectionDisabled}
                        onClick={() => setShowNew((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-olive/40 hover:text-olive/70 disabled:cursor-not-allowed disabled:opacity-50"
                        title={showNew ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showNew ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </span>
                  </label>
                  <label className="grid gap-2 sm:grid-cols-[190px_1fr] sm:items-center">
                    <span className="text-sm font-medium text-olive">Повторите новый пароль</span>
                    <span className="relative block">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        disabled={isPasswordSectionDisabled}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            confirmPassword: event.target.value,
                          }))
                        }
                        className={cn(
                          "h-10 rounded-lg bg-white/90 py-2 pr-10 shadow-[inset_0_1px_2px_rgba(58,43,35,0.04)]",
                          isPasswordSectionDisabled && "cursor-not-allowed bg-cream text-olive/60",
                        )}
                      />
                      <button
                        type="button"
                        disabled={isPasswordSectionDisabled}
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-olive/40 hover:text-olive/70 disabled:cursor-not-allowed disabled:opacity-50"
                        title={showConfirm ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </span>
                  </label>
                </div>
                <div className="mt-5 flex items-start gap-4 rounded-xl bg-primary/8 px-4 py-3 text-sm text-primary">
                  <LockIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    <span className="font-semibold">Для безопасности используйте сложный пароль</span>
                    <br />
                    <span className="text-olive/68">
                      Минимум 8 символов, с цифрами и буквами разного регистра.
                    </span>
                  </p>
                </div>
                <Button
                  onClick={() => void savePassword()}
                  disabled={isPasswordSaving || isPasswordSectionDisabled}
                  className="mt-5 h-11 w-full rounded-lg bg-primary shadow-[0_14px_30px_rgba(15,118,110,0.22)] hover:bg-primary-hover"
                >
                  {isPasswordSaving ? "Сохранение..." : "Изменить пароль"}
                </Button>
                <StatusMessage type="error" message={passwordError} />
                <StatusMessage type="success" message={passwordSuccess} />
              </div>
            ) : (
              <div className="rounded-[18px] bg-white/56 p-5 text-sm text-olive/60 ring-1 ring-olive/10">
                Форма скрыта для безопасности.
              </div>
            )}
          </section>
        </div>

        <section className="mt-3 overflow-hidden rounded-2xl bg-red-50/70 p-4 ring-1 ring-red-100 lg:hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-red-700 ring-1 ring-red-100">
              <LogoutIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-red-900">Выйти из аккаунта</h2>
              <p className="mt-1 text-sm leading-snug text-red-900/65">
                Завершите сессию на этом устройстве, если больше не планируете работать в кабинете.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void logout()}
            disabled={isLoggingOut}
            className="mt-4 w-full border-red-200 bg-white text-red-700 ring-red-100 hover:bg-red-100 hover:text-red-800"
          >
            {isLoggingOut ? "Выходим..." : "Выйти"}
          </Button>
        </section>
      </div>
    </>
  );
}
