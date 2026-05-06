"use client";

import {
  Camera,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  CloudUpload,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imageSizeLimitBytes } from "@/lib/constants";
import { AvatarCropEditor, type CropParams } from "@/components/profile/avatar-crop-editor";

// ── SVG icons ──────────────────────────────────────────────────────────────────

function CameraIcon({ className }: { className?: string }) {
  return <AppIcon icon={Camera} className={className} />;
}

function UserIcon({ className }: { className?: string }) {
  return <AppIcon icon={UserRound} className={className} />;
}

function LockIcon({ className }: { className?: string }) {
  return <AppIcon icon={LockKeyhole} className={className} />;
}

function EyeIcon() {
  return <AppIcon icon={Eye} className="h-4 w-4" />;
}

function EyeOffIcon() {
  return <AppIcon icon={EyeOff} className="h-4 w-4" />;
}

function UploadCloudIcon({ className }: { className?: string }) {
  return <AppIcon icon={CloudUpload} className={className} />;
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
  avatarUrl: string | null;
  updatedAt: string;
};

type ProfileSettingsProps = {
  initialProfile: ProfileItem;
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

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
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
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [cropEditor, setCropEditor] = useState<CropEditorState | null>(null);

  const initials = useMemo(
    () => getInitials({ firstName: profile.firstName }),
    [profile.firstName],
  );
  const isPasswordSectionDisabled = !passwordChangeAvailable;

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

      {/* ── Profile hero ───────────────────────────────────────────────────── */}

      {/* ── Sections ───────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* ── Avatar section ──────────────────────────────────────────── */}
        <section
          id="avatar"
          className="scroll-mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-olive/10"
        >
          <div className="flex items-center justify-between gap-3 border-b border-olive/8 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <CameraIcon className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-olive">Фото профиля</h2>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-5">
              <div
                className={`h-24 w-24 shrink-0 overflow-hidden rounded-full bg-cream ring-2 transition ${
                  profile.avatarUrl ? "ring-primary/30" : "ring-olive/12"
                }`}
              >
                <AvatarImage
                  src={profile.avatarUrl}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                >
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-olive/40">
                    {initials}
                  </div>
                </AvatarImage>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                      isBusy ? "cursor-not-allowed bg-primary/55" : "bg-primary hover:bg-primary/88"
                    }`}
                  >
                    <UploadCloudIcon className="h-4 w-4" />
                    {isBusy ? "Обработка..." : "Загрузить фото"}
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
                  {profile.avatarUrl ? (
                    <Button variant="ghost" disabled={isBusy} onClick={() => void removeAvatar()}>
                      Удалить фото
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-olive/45">
                  PNG, JPEG, WEBP или HEIC · до {formatMegabytes(imageSizeLimitBytes)}
                </p>
              </div>
            </div>
            <StatusMessage type="error" message={avatarError} />
            <StatusMessage type="success" message={avatarSuccess} />
          </div>
        </section>

        {/* ── Personal data section ────────────────────────────────────── */}
        <section
          id="personal"
          className="scroll-mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-olive/10"
        >
          <div className="flex items-center gap-3 border-b border-olive/8 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-olive">Основные данные</h2>
              <p className="text-xs text-olive/45">Имя, фамилия и контакты</p>
            </div>
          </div>
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Имя</span>
                <Input
                  value={profileForm.firstName}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Фамилия</span>
                <Input
                  value={profileForm.lastName}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Телефон</span>
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
                />
              </label>
            </div>
            <div className="mt-5">
              <Button onClick={() => void saveProfile()} disabled={isProfileSaving}>
                {isProfileSaving ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
            <StatusMessage type="error" message={profileError} />
            <StatusMessage type="success" message={profileSuccess} />
          </div>
        </section>

        {/* ── Password section ─────────────────────────────────────────── */}
        <section
          id="password"
          className="scroll-mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-olive/10"
        >
          <div className="flex items-center justify-between gap-3 border-b border-olive/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <LockIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-olive">Смена пароля</h2>
                <p className="text-xs text-olive/45">Обновите пароль для входа</p>
              </div>
            </div>
            <button
              type="button"
              aria-expanded={isPasswordSectionOpen}
              onClick={() => setIsPasswordSectionOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-olive/12 px-3.5 py-2 text-sm font-semibold text-olive transition hover:border-primary/25 hover:text-primary"
            >
              {isPasswordSectionOpen ? "Скрыть" : "Открыть"}
              {isPasswordSectionOpen ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          {isPasswordSectionOpen ? (
            <div className={`p-5${isPasswordSectionDisabled ? " opacity-70" : ""}`}>
              <AvailabilityNotice
                message={isPasswordSectionDisabled ? passwordChangeUnavailableReason : null}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-olive">Текущий пароль</span>
                  <div className="relative">
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
                      className={`pr-9${isPasswordSectionDisabled ? " cursor-not-allowed bg-cream text-olive/60" : ""}`}
                    />
                    <button
                      type="button"
                      disabled={isPasswordSectionDisabled}
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-olive/40 hover:text-olive/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Новый пароль</span>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      disabled={isPasswordSectionDisabled}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                      }
                      className={`pr-9${isPasswordSectionDisabled ? " cursor-not-allowed bg-cream text-olive/60" : ""}`}
                    />
                    <button
                      type="button"
                      disabled={isPasswordSectionDisabled}
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-olive/40 hover:text-olive/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showNew ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-olive">Повторите пароль</span>
                  <div className="relative">
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
                      className={`pr-9${isPasswordSectionDisabled ? " cursor-not-allowed bg-cream text-olive/60" : ""}`}
                    />
                    <button
                      type="button"
                      disabled={isPasswordSectionDisabled}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-olive/40 hover:text-olive/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
              </div>
              <div className="mt-5">
                <Button
                  onClick={() => void savePassword()}
                  disabled={isPasswordSaving || isPasswordSectionDisabled}
                >
                  {isPasswordSaving ? "Сохранение..." : "Изменить пароль"}
                </Button>
              </div>
              <StatusMessage type="error" message={passwordError} />
              <StatusMessage type="success" message={passwordSuccess} />
            </div>
          ) : (
            <div className="p-5 text-sm text-olive/60">
              Форма скрыта для безопасности. Нажмите «Открыть», чтобы сменить пароль.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
