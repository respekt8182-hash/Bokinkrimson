"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import {
  Plus,
  Trash2,
  Check,
  X,
  Send,
  Smile,
  Loader2,
  SlidersHorizontal,
  UserCircle,
  ChevronLeft,
  Pencil,
  Phone,
} from "lucide-react";
import { AdminEmptyState, AdminPageHeader, AdminPanel } from "@/components/admin/admin-ui";
import { cn } from "@/lib/cn";
import { useDocumentVisibility } from "@/hooks/use-document-visibility";

// ─── Types ──────────────────────────────────────────────────────

type Manager = {
  id: string;
  name: string;
  photoUrl: string | null;
  isActive: boolean;
};

type ChatPreview = {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: string;
    senderType: string;
    text: string;
    createdAt: string;
  } | null;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  senderType: string;
  senderName: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: string;
};

type ChatDetail = {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl: string | null;
  };
  messages: ChatMessage[];
};

type Props = {
  initialEnabled: boolean;
  initialTemplates: string[];
  initialManagers: Manager[];
};

// ─── Emoji picker (iPhone-style with categories) ──────────────

const EMOJI_CATEGORIES = [
  {
    id: "recent",
    icon: "🕔",
    label: "Недавние",
    emojis: ["😊", "👍", "❤️", "😂", "🙏", "🔥", "😍", "👋"],
  },
  {
    id: "smileys",
    icon: "😀",
    label: "Смайлы",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "🥹", "😅", "😂",
      "🤣", "🥲", "😊", "😇", "🙂", "🙃", "😉", "😌",
      "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
      "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
      "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏",
      "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤",
      "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶",
      "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓",
      "🧐", "😕", "🫤", "😟", "🙁", "😮", "😯", "😲",
      "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥",
      "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩",
      "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿",
    ],
  },
  {
    id: "gestures",
    icon: "👋",
    label: "Жесты",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳",
      "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
      "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏",
      "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾",
    ],
  },
  {
    id: "hearts",
    icon: "❤️",
    label: "Сердца",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓",
      "💗", "💖", "💘", "💝", "💟", "♥️", "💋", "💌",
    ],
  },
  {
    id: "nature",
    icon: "🌱",
    label: "Природа",
    emojis: [
      "🌸", "💐", "🌷", "🌹", "🥀", "🌺", "🌻", "🌼",
      "🌱", "🌲", "🌳", "🌴", "🌵", "🎋", "🍀", "🍃",
      "🍂", "🍁", "🌾", "🌊", "🌈", "☀️", "🌤️", "⛅",
      "🌥️", "☁️", "🌧️", "⛈️", "🌩️", "❄️", "☃️", "⭐",
      "🌟", "✨", "💫", "🌙", "🐶", "🐱", "🐭", "🐰",
    ],
  },
  {
    id: "food",
    icon: "🍔",
    label: "Еда",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
      "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥝", "🍅",
      "🥑", "🍔", "🍕", "🌭", "🍟", "🍿", "🧀", "🥐",
      "🍞", "🥖", "🧁", "🍰", "🎂", "🍩", "🍪", "🍫",
      "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🥂", "🍾",
    ],
  },
  {
    id: "travel",
    icon: "✈️",
    label: "Путешествия",
    emojis: [
      "🏠", "🏡", "🏢", "🏨", "🏖️", "🏝️", "🗺️", "🌍",
      "🌎", "🌏", "🗻", "⛰️", "🏔️", "🗼", "🏰", "🗽",
      "✈️", "🚗", "🚕", "🚌", "🚢", "⛵", "🚀", "🛸",
    ],
  },
  {
    id: "objects",
    icon: "💡",
    label: "Объекты",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎀", "🎗️", "🏆", "🥇",
      "📱", "💻", "⌨️", "📷", "📹", "🎬", "🎮", "🎧",
      "🎵", "🎶", "🎤", "🎸", "🥁", "🎹", "📚", "📖",
      "💡", "🔔", "💬", "💭", "🗯️", "📝", "✏️", "🔑",
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
    osc.frequency.value = 660;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {}
}

function getUserFullName(user: { firstName: string; lastName: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

function formatChatUpdatedAt(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat(
    "ru-RU",
    isSameDay
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          day: "2-digit",
          month: "short",
        },
  ).format(date);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// ─── Component ──────────────────────────────────────────────────

export function SupportChatManager({ initialEnabled, initialTemplates, initialManagers }: Props) {
  const isDocumentVisible = useDocumentVisibility();
  // ─── State: settings ──────────────────────────────────────
  const [enabled, setEnabled] = useState(initialEnabled);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  // ─── State: managers ──────────────────────────────────────
  const [managers, setManagers] = useState<Manager[]>(initialManagers);
  const [newManagerName, setNewManagerName] = useState("");
  const [newManagerPhoto, setNewManagerPhoto] = useState<File | null>(null);
  const [creatingManager, setCreatingManager] = useState(false);

  // ─── State: templates ─────────────────────────────────────
  const [templates, setTemplates] = useState<string[]>(initialTemplates);
  const [editingTemplateIdx, setEditingTemplateIdx] = useState<number | null>(null);
  const [editingTemplateVal, setEditingTemplateVal] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [savingTemplates, setSavingTemplates] = useState(false);

  // ─── State: chats ─────────────────────────────────────────
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatDetail, setChatDetail] = useState<ChatDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyManagerId, setReplyManagerId] = useState<string>("");
  const [sendingReply, setSendingReply] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState("recent");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const chatsFetchControllerRef = useRef<AbortController | null>(null);
  const detailFetchControllerRef = useRef<AbortController | null>(null);
  const lastChatsFetchAtRef = useRef(0);
  const lastDetailFetchAtRef = useRef(0);
  const resolvedReplyManagerId =
    replyManagerId || managers.find((manager) => manager.isActive)?.id || managers[0]?.id || "";

  // ─── Fetch chats list ─────────────────────────────────────

  const fetchChats = useCallback(async () => {
    if (chatsFetchControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    chatsFetchControllerRef.current = controller;

    try {
      const res = await fetch("/api/admin/support-chat", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setChats(data.chats ?? []);
      lastChatsFetchAtRef.current = Date.now();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    } finally {
      if (chatsFetchControllerRef.current === controller) {
        chatsFetchControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isDocumentVisible) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const runFetch = async () => {
      if (Date.now() - lastChatsFetchAtRef.current > 1200) {
        await fetchChats();
      }
    };

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }

      timer = window.setTimeout(async () => {
        await fetchChats();
        scheduleNext();
      }, 10000);
    };

    void runFetch();
    scheduleNext();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      chatsFetchControllerRef.current?.abort();
      chatsFetchControllerRef.current = null;
    };
  }, [fetchChats, isDocumentVisible]);

  // ─── Fetch chat detail ────────────────────────────────────

  const fetchChatDetail = useCallback(async (chatId: string) => {
    if (detailFetchControllerRef.current) {
      return;
    }

    const controller = new AbortController();
    detailFetchControllerRef.current = controller;

    try {
      const res = await fetch(`/api/admin/support-chat?chatId=${chatId}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const detail = data.chat as ChatDetail;
      setChatDetail(detail);
      lastDetailFetchAtRef.current = Date.now();

      // Sound notification on new messages
      const count = detail.messages.length;
      if (count > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
        const lastMsg = detail.messages[count - 1];
        if (lastMsg.senderType === "user") playNotification();
      }
      prevMsgCountRef.current = count;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    } finally {
      if (detailFetchControllerRef.current === controller) {
        detailFetchControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedChatId || !isDocumentVisible) return;
    prevMsgCountRef.current = 0;
    lastDetailFetchAtRef.current = 0;

    let cancelled = false;
    let timer: number | null = null;

    const runFetch = async () => {
      if (Date.now() - lastDetailFetchAtRef.current > 1200) {
        await fetchChatDetail(selectedChatId);
      }
    };

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }

      timer = window.setTimeout(async () => {
        await fetchChatDetail(selectedChatId);
        scheduleNext();
      }, 5000);
    };

    void runFetch();
    scheduleNext();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      detailFetchControllerRef.current?.abort();
      detailFetchControllerRef.current = null;
    };
  }, [fetchChatDetail, isDocumentVisible, selectedChatId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatDetail?.messages]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSidebarOpen]);

  // ─── Toggle chat enabled ──────────────────────────────────

  async function toggleEnabled() {
    setTogglingEnabled(true);
    const newVal = !enabled;
    const res = await fetch("/api/admin/support-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newVal }),
    });
    if (res.ok) setEnabled(newVal);
    setTogglingEnabled(false);
  }

  // ─── Create manager ───────────────────────────────────────

  async function handleCreateManager(e: FormEvent) {
    e.preventDefault();
    if (!newManagerName.trim() || creatingManager) return;
    setCreatingManager(true);

    const fd = new FormData();
    fd.append("name", newManagerName.trim());
    if (newManagerPhoto) fd.append("photo", newManagerPhoto);

    const res = await fetch("/api/admin/chat-managers", { method: "POST", body: fd });
    if (res.ok) {
      const { manager } = await res.json();
      setManagers((prev) => [...prev, manager]);
      setNewManagerName("");
      setNewManagerPhoto(null);
    }
    setCreatingManager(false);
  }

  async function toggleManagerActive(id: string, activate: boolean) {
    const res = await fetch("/api/admin/chat-managers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: activate }),
    });
    if (res.ok) {
      setManagers((prev) =>
        prev.map((m) => ({
          ...m,
          isActive: m.id === id ? activate : activate ? false : m.isActive,
        })),
      );
    }
  }

  async function deleteManager(id: string) {
    const res = await fetch(`/api/admin/chat-managers?id=${id}`, { method: "DELETE" });
    if (res.ok) setManagers((prev) => prev.filter((m) => m.id !== id));
  }

  // ─── Templates ────────────────────────────────────────────

  async function saveTemplates(newTemplates: string[]) {
    setSavingTemplates(true);
    const res = await fetch("/api/admin/support-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates: newTemplates }),
    });
    if (res.ok) setTemplates(newTemplates);
    setSavingTemplates(false);
  }

  function addTemplate() {
    if (!newTemplate.trim() || templates.length >= 12) return;
    const updated = [...templates, newTemplate.trim()];
    setNewTemplate("");
    saveTemplates(updated);
  }

  function removeTemplate(idx: number) {
    saveTemplates(templates.filter((_, i) => i !== idx));
  }

  function startEditTemplate(idx: number) {
    setEditingTemplateIdx(idx);
    setEditingTemplateVal(templates[idx]);
  }

  function saveEditTemplate() {
    if (editingTemplateIdx === null) return;
    const updated = [...templates];
    updated[editingTemplateIdx] = editingTemplateVal.trim();
    setEditingTemplateIdx(null);
    saveTemplates(updated.filter(Boolean));
  }

  // ─── Send reply ───────────────────────────────────────────

  async function handleSendReply(e: FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedChatId || sendingReply) return;
    setSendingReply(true);

    const res = await fetch("/api/admin/support-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: selectedChatId,
        text: replyText.trim(),
        managerId: resolvedReplyManagerId || undefined,
      }),
    });

    if (res.ok) {
      setReplyText("");
      fetchChatDetail(selectedChatId);
    }
    setSendingReply(false);
  }

  async function deleteChat(chatId: string) {
    if (!confirm("Удалить весь диалог?")) return;
    const res = await fetch(`/api/admin/support-chat?chatId=${chatId}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatId === chatId) {
        closeChat();
      }
    }
  }

  function handleSelectChat(chatId: string) {
    setSelectedChatId(chatId);
    setChatDetail(null);
    setShowEmoji(false);
  }

  function closeChat() {
    setSelectedChatId(null);
    setChatDetail(null);
    setShowEmoji(false);
  }

  // ─── Render ───────────────────────────────────────────────

  const waitingChatsCount = chats.filter((chat) => chat.lastMessage?.senderType === "user").length;
  const hasChatsWithoutWaitingReply = chats.length > 0 && waitingChatsCount === 0;
  const activeManagersCount = managers.filter((manager) => manager.isActive).length;
  const selectedChatPreview = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const selectedChatNeedsReply = selectedChatPreview?.lastMessage?.senderType === "user";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Чат поддержки"
        description="Диалоги, менеджеры и быстрые ответы в одном рабочем окне."
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex items-center gap-3 rounded-[22px] border border-white/80 bg-white/82 px-4 py-3 text-left shadow-[0_14px_30px_rgba(58,43,35,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(58,43,35,0.09)]"
              aria-haspopup="dialog"
              aria-expanded={isSidebarOpen}
              aria-controls="support-chat-settings-panel"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/55">
                  Настройки
                </span>
                <span className="block text-sm font-semibold text-olive">Команда и фразы</span>
              </span>
            </button>

            <div className="flex items-center gap-3 rounded-[22px] border border-white/80 bg-white/78 px-3 py-2 shadow-[0_14px_30px_rgba(58,43,35,0.07)]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/35">
                  Статус канала
                </p>
                <p className="text-sm font-semibold text-olive">
                  {enabled ? "Включён" : "На паузе"}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleEnabled}
                disabled={togglingEnabled}
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                  enabled ? "bg-primary" : "bg-olive/20",
                )}
                aria-label={enabled ? "Отключить чат поддержки" : "Включить чат поддержки"}
                title={enabled ? "Чат поддержки включён" : "Чат поддержки выключен"}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                    enabled ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </div>
          </>
        }
      />

      <div className="grid gap-6">
        {isSidebarOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Закрыть панель управления чатом"
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-midnight/45 backdrop-blur-sm"
            />

            <aside
              id="support-chat-settings-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="support-chat-settings-title"
              className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-white/35 bg-[#f6f2eb]/96 shadow-[0_24px_70px_rgba(43,31,25,0.28)] backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/45 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/55">
                    Настройки
                  </p>
                  <h2
                    id="support-chat-settings-title"
                    className="mt-2 text-lg font-semibold text-olive"
                  >
                    Команда и быстрые ответы
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-olive/60">
                    Здесь собраны менеджеры и готовые фразы, а рабочее окно остаётся чище.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-olive shadow-[0_10px_24px_rgba(58,43,35,0.08)] transition hover:bg-white"
                  aria-label="Закрыть панель"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-6">
                  {/* Managers section */}
                  <AdminPanel
                    title="Команда"
                    description="Профили менеджеров, от имени которых уходят ответы клиентам."
                    actions={
                      <div className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                        {activeManagersCount > 0
                          ? `${activeManagersCount} активен`
                          : "Нет активного"}
                      </div>
                    }
                  >
                    <form
                      onSubmit={handleCreateManager}
                      className="rounded-[24px] border border-olive/10 bg-[linear-gradient(180deg,rgba(247,243,236,0.82),rgba(255,255,255,0.96))] p-4"
                    >
                      <div className="grid gap-3">
                        <label className="space-y-1.5">
                          <span className="text-xs font-medium text-olive/55">Имя менеджера</span>
                          <input
                            value={newManagerName}
                            onChange={(e) => setNewManagerName(e.target.value)}
                            placeholder="Например, Анна"
                            className="w-full rounded-2xl border border-olive/10 bg-white px-3.5 py-2.5 text-sm text-olive outline-none transition focus:border-primary/30"
                            maxLength={100}
                          />
                        </label>

                        <label className="space-y-1.5">
                          <span className="text-xs font-medium text-olive/55">Фото профиля</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => setNewManagerPhoto(e.target.files?.[0] ?? null)}
                            className="w-full text-xs file:mr-3 file:rounded-2xl file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-medium file:text-primary"
                          />
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={creatingManager || !newManagerName.trim()}
                        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-40"
                      >
                        {creatingManager ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Добавить профиль
                      </button>
                    </form>

                    <div className="mt-4 space-y-3">
                      {managers.length === 0 ? (
                        <AdminEmptyState
                          title="Профилей пока нет"
                          description="Добавьте хотя бы одного менеджера, чтобы отвечать в чате от его имени."
                          className="border-none bg-cream/45 shadow-none"
                        />
                      ) : (
                        managers.map((m) => (
                          <div
                            key={m.id}
                            className="rounded-[22px] border border-olive/10 bg-white/82 p-3 shadow-[0_12px_28px_rgba(58,43,35,0.06)]"
                          >
                            <div className="flex items-start gap-3">
                              {m.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.photoUrl}
                                  alt={m.name}
                                  className="h-11 w-11 rounded-2xl object-cover"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream/75 text-olive/30">
                                  <UserCircle className="h-7 w-7" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-olive">{m.name}</p>
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                      m.isActive
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-cream text-olive/55",
                                    )}
                                  >
                                    {m.isActive ? "Активный" : "Неактивный"}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {m.isActive ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleManagerActive(m.id, false)}
                                      className="rounded-full bg-olive/6 px-3 py-1.5 text-xs font-semibold text-olive/65 transition hover:bg-olive/10"
                                    >
                                      Деактивировать
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => toggleManagerActive(m.id, true)}
                                      className="rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/14"
                                    >
                                      Сделать активным
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => deleteManager(m.id)}
                                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Быстрые ответы"
                    description="Короткие заготовки, чтобы отвечать быстрее на типовые вопросы."
                    actions={
                      <div className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">
                        {templates.length}/12
                      </div>
                    }
                  >
                    {templates.length === 0 ? (
                      <AdminEmptyState
                        title="Шаблонов пока нет"
                        description="Добавьте несколько готовых фраз, чтобы ускорить ответы в переписке."
                        className="border-none bg-cream/45 shadow-none"
                      />
                    ) : (
                      <div className="space-y-2">
                        {templates.map((t, i) => (
                          <div
                            key={i}
                            className="rounded-[20px] border border-olive/10 bg-white/82 px-3 py-3 shadow-[0_10px_24px_rgba(58,43,35,0.05)]"
                          >
                            <div className="flex gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {i + 1}
                              </div>

                              {editingTemplateIdx === i ? (
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <input
                                    value={editingTemplateVal}
                                    onChange={(e) => setEditingTemplateVal(e.target.value)}
                                    className="flex-1 rounded-xl border border-olive/10 bg-cream/65 px-3 py-2 text-sm text-olive outline-none transition focus:border-primary/30"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && saveEditTemplate()}
                                  />
                                  <button
                                    type="button"
                                    onClick={saveEditTemplate}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15"
                                    aria-label="Сохранить шаблон"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTemplateIdx(null)}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-olive/6 text-olive/55 transition hover:bg-olive/10"
                                    aria-label="Отменить редактирование шаблона"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  <p className="flex-1 text-sm leading-6 text-olive">{t}</p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditTemplate(i)}
                                      className="flex h-9 w-9 items-center justify-center rounded-xl text-olive/45 transition hover:bg-cream/80 hover:text-olive"
                                      aria-label="Редактировать шаблон"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeTemplate(i)}
                                      className="flex h-9 w-9 items-center justify-center rounded-xl text-red-400 transition hover:bg-red-50 hover:text-red-600"
                                      aria-label="Удалить шаблон"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {templates.length < 12 ? (
                      <div className="mt-4 rounded-[24px] border border-olive/10 bg-[linear-gradient(180deg,rgba(247,243,236,0.82),rgba(255,255,255,0.96))] p-4">
                        <label className="space-y-1.5">
                          <span className="text-xs font-medium text-olive/55">Новая фраза</span>
                          <input
                            value={newTemplate}
                            onChange={(e) => setNewTemplate(e.target.value)}
                            placeholder="Например, уточните удобное время для звонка"
                            className="w-full rounded-2xl border border-olive/10 bg-white px-3.5 py-2.5 text-sm text-olive outline-none transition focus:border-primary/30"
                            onKeyDown={(e) => e.key === "Enter" && addTemplate()}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={addTemplate}
                          disabled={!newTemplate.trim() || savingTemplates}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-40"
                        >
                          {savingTemplates ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Добавить фразу
                        </button>
                      </div>
                    ) : null}
                  </AdminPanel>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        <AdminPanel
          title="Рабочее окно"
          description="Слева очередь обращений, справа переписка и ответ от имени выбранного менеджера."
          actions={
            <div
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                waitingChatsCount > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800",
              )}
            >
              {waitingChatsCount > 0
                ? `${waitingChatsCount} ждут ответа`
                : hasChatsWithoutWaitingReply
                  ? "Активные диалоги без новых сообщений"
                  : "Все обращения разобраны"}
            </div>
          }
          className="order-1 overflow-hidden"
          contentClassName="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6"
        >
          <div className="grid min-h-[720px] bg-[linear-gradient(180deg,rgba(252,250,245,0.88),rgba(255,255,255,0.97))] lg:grid-cols-[320px_minmax(0,1fr)]">
            <div
              className={cn(
                "border-b border-olive/8 bg-[#fcfbf8]/80 lg:border-b-0 lg:border-r lg:border-olive/8",
                selectedChatId ? "hidden lg:block" : "block",
              )}
            >
              <div className="border-b border-olive/8 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/35">
                      Очередь
                    </p>
                    <p className="text-sm font-semibold text-olive">Все обращения</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-olive/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    {chats.length}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-olive/48">
                  {waitingChatsCount > 0
                    ? "Сначала обработайте диалоги, где последним написал пользователь."
                    : hasChatsWithoutWaitingReply
                      ? "В очереди остались диалоги, но новых сообщений без ответа сейчас нет."
                      : "Новых сообщений без ответа сейчас нет."}
                </p>
              </div>

              {chats.length === 0 ? (
                <div className="p-4">
                  <AdminEmptyState
                    title="Обращений пока нет"
                    description="Когда пользователи начнут писать, здесь появится очередь диалогов."
                    className="border-none bg-white/70 px-4 py-8 shadow-none"
                  />
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {chats.map((chat) => {
                    const isWaiting = chat.lastMessage?.senderType === "user";
                    const isSelected = selectedChatId === chat.id;

                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => handleSelectChat(chat.id)}
                        className={cn(
                          "w-full rounded-[22px] border px-3.5 py-3 text-left transition",
                          isSelected
                            ? "border-primary/18 bg-white shadow-[0_14px_30px_rgba(58,43,35,0.08)]"
                            : "border-transparent bg-transparent hover:border-olive/10 hover:bg-white/72",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {chat.user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={chat.user.avatarUrl}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-olive/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              <UserCircle className="h-6 w-6" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-olive">
                                  {getUserFullName(chat.user)}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.14em] text-olive/35">
                                  {chat.user.phone}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-medium text-olive/40">
                                  {formatChatUpdatedAt(chat.updatedAt)}
                                </p>
                                <span
                                  className={cn(
                                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                    isWaiting
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-700",
                                  )}
                                >
                                  {isWaiting ? "Ждёт" : "В работе"}
                                </span>
                              </div>
                            </div>

                            <p className="mt-2 truncate text-sm text-olive/58">
                              {chat.lastMessage?.text || "Сообщений пока нет"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              className={cn("flex min-w-0 flex-col", selectedChatId ? "flex" : "hidden lg:flex")}
            >
              {!selectedChatId ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <AdminEmptyState
                    title="Выберите диалог"
                    description="Откройте обращение из очереди слева, чтобы увидеть переписку и отправить ответ."
                    className="max-w-md border-none bg-white/72 shadow-none"
                  />
                </div>
              ) : !chatDetail ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-olive">Загружаем переписку</p>
                    <p className="mt-1 text-sm text-olive/50">
                      Подтягиваем сообщения и данные клиента.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-olive/8 bg-white/92 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <button
                        type="button"
                        onClick={closeChat}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-olive/10 bg-cream/75 text-olive lg:hidden"
                        aria-label="Вернуться к списку диалогов"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      {chatDetail.user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={chatDetail.user.avatarUrl}
                          alt=""
                          className="hidden h-12 w-12 rounded-2xl object-cover sm:block"
                        />
                      ) : (
                        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-cream/80 text-olive/30 sm:flex">
                          <UserCircle className="h-7 w-7" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-olive">
                            {getUserFullName(chatDetail.user)}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              selectedChatNeedsReply
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700",
                            )}
                          >
                            {selectedChatNeedsReply ? "Ждёт ответа" : "Диалог активен"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-olive/50">
                          <span className="inline-flex items-center gap-1 rounded-full bg-cream/75 px-2.5 py-1">
                            <Phone className="h-3.5 w-3.5" />
                            {chatDetail.user.phone}
                          </span>
                          {selectedChatPreview ? (
                            <span className="rounded-full bg-white px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                              Обновлён {formatChatUpdatedAt(selectedChatPreview.updatedAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteChat(chatDetail.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200/80 bg-red-50/95 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Удалить диалог</span>
                      </button>
                    </div>
                  </div>

                  <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(247,243,236,0.84),rgba(255,255,255,0.94))] px-4 py-5 sm:px-5"
                  >
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                      {chatDetail.messages.length === 0 ? (
                        <AdminEmptyState
                          title="Переписка ещё не началась"
                          description="Как только в диалоге появятся сообщения, они отобразятся здесь."
                          className="border-none bg-white/72 shadow-none"
                        />
                      ) : (
                        chatDetail.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.senderType === "user" ? "justify-start" : "justify-end",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[88%] rounded-[24px] border px-4 py-3 text-sm leading-relaxed shadow-[0_14px_30px_rgba(58,43,35,0.07)]",
                                msg.senderType === "user"
                                  ? "rounded-bl-md border-white/80 bg-white text-olive"
                                  : "rounded-br-md border-primary/10 bg-[linear-gradient(135deg,rgba(15,118,110,0.94),rgba(14,116,144,0.86))] text-white",
                              )}
                            >
                              {msg.senderType === "moderator" && msg.senderName ? (
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/72">
                                  {msg.senderName}
                                </p>
                              ) : null}

                              {msg.imageUrl ? (
                                <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.imageUrl}
                                    alt=""
                                    className="mb-2 max-h-56 rounded-2xl object-cover"
                                  />
                                </a>
                              ) : null}

                              {msg.text.trim() ? (
                                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                              ) : null}

                              <p
                                className={cn(
                                  "mt-2 text-right text-[10px] font-medium",
                                  msg.senderType === "user" ? "text-olive/35" : "text-white/58",
                                )}
                              >
                                {formatMessageTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <form
                    onSubmit={handleSendReply}
                    className="border-t border-olive/8 bg-white/90 px-4 py-4 sm:px-5"
                  >
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                      {managers.length > 0 ? (
                        <label className="space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive/38">
                            От имени
                          </span>
                          <select
                            value={resolvedReplyManagerId}
                            onChange={(e) => setReplyManagerId(e.target.value)}
                            className="w-full rounded-2xl border border-olive/10 bg-cream/70 px-3 py-2 text-sm text-olive outline-none transition focus:border-primary/30"
                          >
                            {managers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.isActive ? "(активный)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <div className="flex items-end gap-2 sm:gap-3">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowEmoji((value) => !value)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-olive/10 bg-cream/72 text-olive/55 transition hover:border-primary/16 hover:text-primary"
                            aria-label="Открыть список эмодзи"
                          >
                            <Smile className="h-5 w-5" />
                          </button>
                          {showEmoji ? (
                            <>
                              {/* Backdrop to close */}
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowEmoji(false)}
                              />
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
                                      style={{ fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" }}
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
                                          style={{ fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" }}
                                          onClick={() => {
                                            setReplyText((text) => text + emoji);
                                            setShowEmoji(false);
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
                          ) : null}
                        </div>

                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendReply(e);
                            }
                          }}
                          placeholder="Напишите ответ"
                          rows={1}
                          className="min-h-[52px] max-h-[140px] flex-1 resize-none rounded-[24px] border border-olive/10 bg-cream/72 px-4 py-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/30"
                        />

                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim()}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
                          aria-label="Отправить сообщение"
                        >
                          {sendingReply ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <p className="text-[11px] text-olive/40">
                        Enter отправляет сообщение, Shift + Enter переносит строку.
                      </p>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
