"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { MessageCircle, X, Send, Paperclip, Smile, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDocumentVisibility } from "@/hooks/use-document-visibility";

// ─── Types ──────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  senderType: "user" | "moderator";
  senderName: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: string;
};

type Manager = { name: string; photoUrl: string | null } | null;

type ChatData = {
  enabled: boolean;
  manager: Manager;
  templates: string[];
  social: { telegram: string; max: string };
  messages: ChatMessage[];
  chatConsentGiven: boolean;
};

// ─── Draft persistence ──────────────────────────────────────────

const DRAFT_KEY = "support-chat-draft-v3";

function loadDraft(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DRAFT_KEY) ?? "";
}

function saveDraft(value: string) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(DRAFT_KEY, value);
  else localStorage.removeItem(DRAFT_KEY);
}

// ─── Emoji picker (iPhone-style with categories) ──────────────

const EMOJI_CATEGORIES = [
  {
    id: "recent",
    icon: "\u{1F554}",
    label: "Недавние",
    emojis: ["😊", "👍", "❤️", "😂", "🙏", "🔥", "😍", "👋"],
  },
  {
    id: "smileys",
    icon: "\u{1F600}",
    label: "Смайлы",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "🥹",
      "😅",
      "😂",
      "🤣",
      "🥲",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🫡",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "🫥",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "🥸",
      "😎",
      "🤓",
      "🧐",
      "😕",
      "🫤",
      "😟",
      "🙁",
      "😮",
      "😯",
      "😲",
      "😳",
      "🥺",
      "🥹",
      "😦",
      "😧",
      "😨",
      "😰",
      "😥",
      "😢",
      "😭",
      "😱",
      "😖",
      "😣",
      "😞",
      "😓",
      "😩",
      "😫",
      "🥱",
      "😤",
      "😡",
      "😠",
      "🤬",
      "😈",
      "👿",
    ],
  },
  {
    id: "gestures",
    icon: "\u{1F44B}",
    label: "Жесты",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "🫱",
      "🫲",
      "🫳",
      "🫴",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🫰",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "🫵",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "🫶",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "💪",
      "🦾",
    ],
  },
  {
    id: "hearts",
    icon: "\u{2764}\u{FE0F}",
    label: "Сердца",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❤️‍🔥",
      "❤️‍🩹",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "♥️",
      "💋",
      "💌",
    ],
  },
  {
    id: "nature",
    icon: "\u{1F331}",
    label: "Природа",
    emojis: [
      "🌸",
      "💐",
      "🌷",
      "🌹",
      "🥀",
      "🌺",
      "🌻",
      "🌼",
      "🌱",
      "🌲",
      "🌳",
      "🌴",
      "🌵",
      "🎋",
      "🍀",
      "🍃",
      "🍂",
      "🍁",
      "🌾",
      "🌊",
      "🌈",
      "☀️",
      "🌤️",
      "⛅",
      "🌥️",
      "☁️",
      "🌧️",
      "⛈️",
      "🌩️",
      "❄️",
      "☃️",
      "⭐",
      "🌟",
      "✨",
      "💫",
      "🌙",
      "🐶",
      "🐱",
      "🐭",
      "🐰",
    ],
  },
  {
    id: "food",
    icon: "\u{1F354}",
    label: "Еда",
    emojis: [
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥝",
      "🍅",
      "🥑",
      "🍔",
      "🍕",
      "🌭",
      "🍟",
      "🍿",
      "🧀",
      "🥐",
      "🍞",
      "🥖",
      "🧁",
      "🍰",
      "🎂",
      "🍩",
      "🍪",
      "🍫",
      "☕",
      "🍵",
      "🧃",
      "🥤",
      "🍺",
      "🍷",
      "🥂",
      "🍾",
    ],
  },
  {
    id: "travel",
    icon: "\u{2708}\u{FE0F}",
    label: "Путешествия",
    emojis: [
      "🏠",
      "🏡",
      "🏢",
      "🏨",
      "🏖️",
      "🏝️",
      "🗺️",
      "🌍",
      "🌎",
      "🌏",
      "🗻",
      "⛰️",
      "🏔️",
      "🗼",
      "🏰",
      "🗽",
      "✈️",
      "🚗",
      "🚕",
      "🚌",
      "🚢",
      "⛵",
      "🚀",
      "🛸",
    ],
  },
  {
    id: "objects",
    icon: "\u{1F4A1}",
    label: "Объекты",
    emojis: [
      "🎉",
      "🎊",
      "🎈",
      "🎁",
      "🎀",
      "🎗️",
      "🏆",
      "🥇",
      "📱",
      "💻",
      "⌨️",
      "📷",
      "📹",
      "🎬",
      "🎮",
      "🎧",
      "🎵",
      "🎶",
      "🎤",
      "🎸",
      "🥁",
      "🎹",
      "📚",
      "📖",
      "💡",
      "🔔",
      "💬",
      "💭",
      "🗯️",
      "📝",
      "✏️",
      "🔑",
    ],
  },
] as const;

// ─── Notification sound ─────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function playNotification() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // no audio context available
  }
}

// ─── Component ──────────────────────────────────────────────────

export function SupportChatWidget() {
  const isDocumentVisible = useDocumentVisibility();
  const [open, setOpen] = useState(false);
  const [hoverMenu, setHoverMenu] = useState(false);
  const [data, setData] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(loadDraft);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState("recent");
  const [consentChecked, setConsentChecked] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(0);
  const openRef = useRef(open);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const retryAfterUntilRef = useRef(0);
  const lastFetchedAtRef = useRef(0);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // ─── Fetch chat data ───────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (activeFetchControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    activeFetchControllerRef.current = controller;

    try {
      const res = await fetch("/api/support-chat", {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 429) {
          const body = (await res.json().catch(() => null)) as { retryAfterSec?: number } | null;
          const retryAfterHeader = Number.parseInt(res.headers.get("Retry-After") ?? "", 10);
          const retryAfterSec =
            body?.retryAfterSec ??
            (Number.isFinite(retryAfterHeader) ? retryAfterHeader : null) ??
            30;
          retryAfterUntilRef.current = Date.now() + retryAfterSec * 1000;
        }
        return;
      }

      retryAfterUntilRef.current = 0;
      lastFetchedAtRef.current = Date.now();

      const d: ChatData = await res.json();
      setData(d);
      setMessages(d.messages);

      // Track unread (new moderator messages since last open)
      if (!openRef.current) {
        const newModeratorMsgs = d.messages.filter((m) => m.senderType === "moderator").length;
        const prevModeratorMsgs = prevMessageCountRef.current;
        if (newModeratorMsgs > prevModeratorMsgs && prevModeratorMsgs > 0) {
          setUnreadCount((c) => c + (newModeratorMsgs - prevModeratorMsgs));
          playNotification();
        }
        prevMessageCountRef.current = newModeratorMsgs;
      } else {
        prevMessageCountRef.current = d.messages.filter((m) => m.senderType === "moderator").length;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      // silent fail for polling
    } finally {
      if (activeFetchControllerRef.current === controller) {
        activeFetchControllerRef.current = null;
      }
    }
  }, []);

  const isChatEnabled = data?.enabled !== false;
  const hasChatConsent = data?.chatConsentGiven === true;

  useEffect(() => {
    if (!isDocumentVisible) {
      return;
    }

    if (!isChatEnabled) {
      return;
    }

    const baseDelayMs = open ? 6000 : hasChatConsent ? 30000 : 90000;
    let cancelled = false;
    let timer: number | null = null;

    const runFetch = async () => {
      if (Date.now() - lastFetchedAtRef.current > 1200) {
        await fetchData();
      }
    };

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }

      const retryDelayMs = Math.max(0, retryAfterUntilRef.current - Date.now());
      timer = window.setTimeout(
        async () => {
          await fetchData();
          scheduleNext();
        },
        Math.max(baseDelayMs, retryDelayMs),
      );
    };

    void runFetch();
    scheduleNext();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      activeFetchControllerRef.current?.abort();
      activeFetchControllerRef.current = null;
    };
  }, [fetchData, hasChatConsent, isChatEnabled, isDocumentVisible, open]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [draft, autoResize]);

  // ─── Handlers ─────────────────────────────────────────────

  function handleDraftChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setDraft(val);
    saveDraft(val);
  }

  function handleOpen() {
    setUnreadCount(0);
    setOpen(true);
    if (Date.now() - lastFetchedAtRef.current > 1500) {
      void fetchData();
    }
  }

  async function handleSend(text?: string) {
    const msgText = (text ?? draft).trim();
    if (!msgText || sending) return;
    if (!data?.chatConsentGiven && !consentChecked) {
      setError("Необходимо согласие на обработку данных");
      return;
    }

    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: msgText,
          grantConsent: !data?.chatConsentGiven ? consentChecked : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ошибка отправки" }));
        setError(err.error || "Ошибка отправки");
        setSending(false);
        return;
      }

      const { message } = await res.json();
      setMessages((prev) => [...prev, message]);
      setDraft("");
      saveDraft("");
      if (data && !data.chatConsentGiven) {
        setData({ ...data, chatConsentGiven: true });
      }
    } catch {
      setError("Ошибка сети");
    }
    setSending(false);
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!data?.chatConsentGiven && !consentChecked) {
      setError("Необходимо согласие на обработку данных");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/support-chat/upload", {
        method: "POST",
        body: fd,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "Ошибка загрузки" }));
        setError(err.error);
        setUploading(false);
        return;
      }

      const { originalUrl } = await uploadRes.json();

      // Send as message with image
      const msgRes = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: " ",
          imageUrl: originalUrl,
          grantConsent: !data?.chatConsentGiven ? consentChecked : undefined,
        }),
      });

      if (msgRes.ok) {
        const { message } = await msgRes.json();
        setMessages((prev) => [...prev, message]);
        if (data && !data.chatConsentGiven) {
          setData({ ...data, chatConsentGiven: true });
        }
      }
    } catch {
      setError("Ошибка загрузки");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend();
  }

  // Don't render if chat is disabled and no data
  if (data && !data.enabled) return null;

  const hasManager = !!data?.manager;

  return (
    <>
      {/* ─── Desktop hover menu (appears on button hover) ─── */}
      <div
        className="fixed right-6 bottom-6 z-[9998] hidden lg:block"
        onMouseEnter={() => setHoverMenu(true)}
        onMouseLeave={() => setHoverMenu(false)}
      >
        {/* Hover menu */}
        <div
          className={cn(
            "absolute right-0 bottom-full mb-3 min-w-[210px] origin-bottom-right transition-all duration-200",
            hoverMenu && !open
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0",
          )}
        >
          <div className="overflow-hidden rounded-l-2xl rounded-tr-2xl border border-primary/10 bg-white/95 shadow-xl backdrop-blur-md">
            {data?.social.telegram && (
              <a
                href={data.social.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 text-sm text-olive/80 transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <svg className="h-5 w-5 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
                Telegram
              </a>
            )}
            {data?.social.max && (
              <a
                href={data.social.max}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border-t border-olive/5 px-4 py-3 text-sm text-olive/80 transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <svg className="h-5 w-5 text-[#168ACD]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                  <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
                </svg>
                MAX мессенджер
              </a>
            )}
            <button
              onClick={() => {
                handleOpen();
                setHoverMenu(false);
              }}
              className="flex w-full items-center gap-3 border-t border-olive/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              <MessageCircle className="h-5 w-5" />
              Написать в чат
            </button>
          </div>
        </div>

        {/* Desktop FAB */}
        <button
          onClick={handleOpen}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary via-primary/90 to-primary shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl",
            open && "pointer-events-none scale-0 opacity-0",
          )}
        >
          <MessageCircle className="h-6 w-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unreadCount}
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-40" />
            </span>
          )}
          {hasManager && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
            </span>
          )}
        </button>
      </div>

      {/* ─── Mobile FAB ─── */}
      <button
        onClick={handleOpen}
        aria-label="Открыть чат с менеджером"
        className={cn(
          "fixed right-0 top-[68%] z-[9998] flex w-[4.25rem] -translate-y-1/2 flex-col items-center gap-2 rounded-l-[1.5rem] border border-r-0 border-primary/12 bg-white/94 px-2 py-3 text-center shadow-[0_20px_44px_-28px_rgba(26,114,104,0.62)] backdrop-blur-sm lg:hidden",
          "transition-[transform,opacity,box-shadow] duration-200 active:scale-[0.98]",
          open && "pointer-events-none translate-x-full opacity-0",
        )}
      >
        <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-primary/18" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary/92 to-primary/80 text-white shadow-[0_16px_28px_-18px_rgba(36,102,94,0.9)]">
          <MessageCircle className="h-5 w-5" />
          {hasManager && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
            </span>
          )}
        </span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-primary/68">
          Чат
        </span>
        {unreadCount > 0 && (
          <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unreadCount}
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-40" />
          </span>
        )}
      </button>

      {/* ─── Chat panel ─── */}
      <div
        className={cn(
          "fixed z-[9999] flex flex-col overflow-hidden bg-white transform-gpu",
          // Desktop
          "lg:right-6 lg:bottom-6 lg:h-[min(680px,88vh)] lg:w-[430px] lg:rounded-2xl lg:border lg:border-olive/8",
          // Mobile
          "top-2 right-2 bottom-2 left-auto w-[min(24rem,calc(100vw-1rem))] rounded-[1.75rem] border border-olive/8 lg:top-auto",
          // Shadow
          "shadow-[0_34px_90px_-40px_rgba(43,31,25,0.42)]",
          // Animation
          "origin-right transition-[transform,opacity] lg:origin-bottom-right",
          open
            ? "pointer-events-auto translate-x-0 opacity-100 duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:scale-100"
            : "pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0 duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 lg:scale-95",
        )}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 bg-gradient-to-r from-primary via-primary/90 to-primary/80 px-4 py-3.5">
          {data?.manager?.photoUrl ? (
            <img
              src={data.manager.photoUrl}
              alt={data.manager.name}
              className="h-10 w-10 rounded-full border-2 border-white/30 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/30 bg-white/20">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {data?.manager?.name ?? "Поддержка"}
            </p>
            {hasManager && (
              <p className="flex items-center gap-1.5 text-xs text-white/70">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Операторы онлайн
              </p>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#faf8f5] px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageCircle className="h-10 w-10 text-primary/20" />
              <p className="text-sm text-olive/40">Напишите нам — мы ответим в ближайшее время</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.senderType === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.senderType === "user"
                    ? "rounded-2xl rounded-br-md bg-primary text-white"
                    : "rounded-2xl rounded-bl-md border border-olive/8 bg-white text-olive",
                )}
              >
                {msg.senderType === "moderator" && msg.senderName && (
                  <p className="mb-1 text-xs font-semibold text-primary">{msg.senderName}</p>
                )}
                {msg.imageUrl && (
                  <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={msg.imageUrl}
                      alt=""
                      className="mb-1.5 max-h-48 rounded-lg object-cover"
                    />
                  </a>
                )}
                {msg.text.trim() && (
                  <p
                    className="whitespace-pre-wrap break-words"
                    style={{
                      fontFamily:
                        "inherit, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
                    }}
                  >
                    {msg.text}
                  </p>
                )}
                <p
                  className={cn(
                    "mt-1 text-right text-[10px]",
                    msg.senderType === "user" ? "text-white/50" : "text-olive/30",
                  )}
                >
                  {new Date(msg.createdAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Templates */}
        {data?.templates && data.templates.length > 0 && messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-olive/5 bg-white px-4 py-2.5">
            {data.templates.map((t) => (
              <button
                key={t}
                onClick={() => handleSend(t)}
                disabled={sending}
                className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Consent */}
        {data && !data.chatConsentGiven && (
          <div className="border-t border-olive/5 bg-white px-4 py-2.5">
            <label className="flex cursor-pointer items-start gap-2 text-xs text-olive/60">
              <input
                type="checkbox"
                id="support-chat-consent"
                name="supportChatConsent"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                Я даю согласие на обработку персональных данных.{" "}
                <a
                  href="/consent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Подробнее
                </a>
              </span>
            </label>
          </div>
        )}

        {/* Error */}
        {error && <div className="bg-red-50 px-4 py-2 text-xs text-red-600">{error}</div>}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 border-t border-olive/8 bg-white px-3 py-3"
        >
          {/* Image upload */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-olive/35 transition-colors hover:bg-olive/5 hover:text-olive/60"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </button>

          {/* Emoji */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-olive/35 transition-colors hover:bg-olive/5 hover:text-olive/60"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showEmoji && (
              <>
                {/* Backdrop to close */}
                <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                {/* Picker */}
                <div className="absolute bottom-full left-0 z-20 mb-2 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-olive/10 bg-white shadow-2xl">
                  {/* Category tabs */}
                  <div className="flex border-b border-olive/8 bg-[#f6f6f6] px-1">
                    {EMOJI_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEmojiCategory(cat.id)}
                        className={cn(
                          "flex flex-1 items-center justify-center py-2 text-lg transition-all",
                          emojiCategory === cat.id
                            ? "scale-110"
                            : "opacity-50 grayscale hover:opacity-80 hover:grayscale-0",
                        )}
                        title={cat.label}
                        style={{
                          fontFamily:
                            "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
                        }}
                      >
                        {cat.icon}
                      </button>
                    ))}
                  </div>

                  {/* Category label */}
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
                      {EMOJI_CATEGORIES.find((c) => c.id === emojiCategory)?.label}
                    </span>
                  </div>

                  {/* Emoji grid */}
                  <div className="custom-scrollbar max-h-[220px] overflow-y-auto px-2 pb-2">
                    <div className="grid grid-cols-8 gap-0.5">
                      {EMOJI_CATEGORIES.find((c) => c.id === emojiCategory)?.emojis.map(
                        (emoji, i) => (
                          <button
                            key={`${emoji}-${i}`}
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] transition-all hover:scale-125 hover:bg-olive/8 active:scale-95"
                            style={{
                              fontFamily:
                                "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
                            }}
                            onClick={() => {
                              setDraft((d) => d + emoji);
                              saveDraft(draft + emoji);
                              setShowEmoji(false);
                              textareaRef.current?.focus();
                            }}
                          >
                            {emoji}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            id="support-chat-message"
            name="message"
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            placeholder="Написать сообщение..."
            rows={1}
            className="max-h-[120px] min-h-[36px] flex-1 resize-none rounded-[22px] border border-olive/10 bg-[#faf8f5] px-4 py-2 text-sm text-olive outline-none transition-colors placeholder:text-olive/30 focus:border-primary/30 focus:ring-1 focus:ring-primary/20"
          />

          {/* Send */}
          <button
            type="submit"
            disabled={sending || (!draft.trim() && !uploading)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all hover:bg-primary-hover disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-[9998] bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
