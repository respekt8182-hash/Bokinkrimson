"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import {
  Headset,
  Plus,
  Trash2,
  Check,
  X,
  Send,
  Smile,
  Paperclip,
  Loader2,
  UserCircle,
  MessageCircle,
  ChevronLeft,
  Pencil,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Types ──────────────────────────────────────────────────────

type Manager = {
  id: string;
  name: string;
  photoUrl: string | null;
  isActive: boolean;
};

type ChatPreview = {
  id: string;
  user: { id: string; firstName: string; lastName: string; phone: string; avatarUrl: string | null };
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
  user: { id: string; firstName: string; lastName: string; phone: string; avatarUrl: string | null };
  messages: ChatMessage[];
};

type Props = {
  initialEnabled: boolean;
  initialTemplates: string[];
  initialManagers: Manager[];
};

// ─── Emoji set ──────────────────────────────────────────────────

const EMOJIS = ["😊", "👍", "❤️", "🙏", "😄", "🤔", "👋", "🌊", "☀️", "🏠", "🗺️", "🎉", "😢", "🔥", "💬"];

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

// ─── Component ──────────────────────────────────────────────────

export function SupportChatManager({ initialEnabled, initialTemplates, initialManagers }: Props) {
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  // ─── Fetch chats list ─────────────────────────────────────

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support-chat");
      if (!res.ok) return;
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchChats();
    const iv = setInterval(fetchChats, 5000);
    return () => clearInterval(iv);
  }, [fetchChats]);

  // ─── Fetch chat detail ────────────────────────────────────

  const fetchChatDetail = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/admin/support-chat?chatId=${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      const detail = data.chat as ChatDetail;
      setChatDetail(detail);

      // Sound notification on new messages
      const count = detail.messages.length;
      if (count > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
        const lastMsg = detail.messages[count - 1];
        if (lastMsg.senderType === "user") playNotification();
      }
      prevMsgCountRef.current = count;
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    prevMsgCountRef.current = 0;
    fetchChatDetail(selectedChatId);
    const iv = setInterval(() => fetchChatDetail(selectedChatId), 3000);
    return () => clearInterval(iv);
  }, [selectedChatId, fetchChatDetail]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatDetail?.messages]);

  // Set default reply manager
  useEffect(() => {
    if (!replyManagerId && managers.length > 0) {
      const active = managers.find((m) => m.isActive);
      setReplyManagerId(active?.id ?? managers[0].id);
    }
  }, [managers, replyManagerId]);

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
        managerId: replyManagerId || undefined,
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
        setSelectedChatId(null);
        setChatDetail(null);
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Headset className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-olive">Чат поддержки</h1>
        </div>

        {/* Toggle */}
        <button
          onClick={toggleEnabled}
          disabled={togglingEnabled}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-olive/20",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {/* Managers section */}
      <section className="rounded-xl border border-olive/8 bg-white/80 p-4">
        <h2 className="mb-3 text-sm font-semibold text-olive">Профили менеджеров</h2>

        <form onSubmit={handleCreateManager} className="mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-olive/50">Имя менеджера</label>
            <input
              value={newManagerName}
              onChange={(e) => setNewManagerName(e.target.value)}
              placeholder="Имя"
              className="w-full rounded-lg border border-olive/10 bg-cream px-3 py-2 text-sm text-olive outline-none focus:border-primary/30"
              maxLength={100}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-olive/50">Фото</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setNewManagerPhoto(e.target.files?.[0] ?? null)}
              className="w-[140px] text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-2 file:py-1.5 file:text-xs file:text-primary"
            />
          </div>
          <button
            type="submit"
            disabled={creatingManager || !newManagerName.trim()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            {creatingManager ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Добавить
          </button>
        </form>

        <div className="space-y-2">
          {managers.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-olive/5 bg-cream/50 px-3 py-2.5"
            >
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.name} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <UserCircle className="h-9 w-9 text-olive/20" />
              )}
              <span className="flex-1 text-sm font-medium text-olive">{m.name}</span>

              {m.isActive ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Активный
                </span>
              ) : (
                <button
                  onClick={() => toggleManagerActive(m.id, true)}
                  className="rounded-full bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Активировать
                </button>
              )}

              {m.isActive && (
                <button
                  onClick={() => toggleManagerActive(m.id, false)}
                  className="rounded-full bg-olive/5 px-2.5 py-1 text-xs text-olive/50 hover:bg-olive/10"
                >
                  Деактивировать
                </button>
              )}

              <button
                onClick={() => deleteManager(m.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {managers.length === 0 && (
            <p className="py-4 text-center text-sm text-olive/30">Нет менеджеров</p>
          )}
        </div>
      </section>

      {/* Templates section */}
      <section className="rounded-xl border border-olive/8 bg-white/80 p-4">
        <h2 className="mb-3 text-sm font-semibold text-olive">
          Быстрые фразы
          <span className="ml-2 text-xs font-normal text-olive/40">({templates.length}/12)</span>
        </h2>

        <div className="mb-3 space-y-1.5">
          {templates.map((t, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-olive/5 bg-cream/50 px-3 py-2">
              {editingTemplateIdx === i ? (
                <>
                  <input
                    value={editingTemplateVal}
                    onChange={(e) => setEditingTemplateVal(e.target.value)}
                    className="flex-1 rounded border border-olive/10 bg-white px-2 py-1 text-sm text-olive outline-none focus:border-primary/30"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveEditTemplate()}
                  />
                  <button onClick={saveEditTemplate} className="text-primary hover:text-primary-hover">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingTemplateIdx(null)} className="text-olive/40 hover:text-olive">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-olive">{t}</span>
                  <button onClick={() => startEditTemplate(i)} className="text-olive/30 hover:text-olive/60">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => removeTemplate(i)} className="text-red-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {templates.length < 12 && (
          <div className="flex gap-2">
            <input
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="Новая фраза..."
              className="flex-1 rounded-lg border border-olive/10 bg-cream px-3 py-2 text-sm text-olive outline-none focus:border-primary/30"
              onKeyDown={(e) => e.key === "Enter" && addTemplate()}
            />
            <button
              onClick={addTemplate}
              disabled={!newTemplate.trim() || savingTemplates}
              className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-40"
            >
              {savingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : "Добавить"}
            </button>
          </div>
        )}
      </section>

      {/* Chats section */}
      <section className="rounded-xl border border-olive/8 bg-white/80">
        <div className="border-b border-olive/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-olive">
            Диалоги
            <span className="ml-2 text-xs font-normal text-olive/40">({chats.length})</span>
          </h2>
        </div>

        <div className="flex" style={{ minHeight: 400 }}>
          {/* Chat list */}
          <div
            className={cn(
              "w-full border-r border-olive/5 md:w-[280px]",
              selectedChatId ? "hidden md:block" : "block",
            )}
          >
            {chats.length === 0 ? (
              <p className="py-8 text-center text-sm text-olive/30">Нет диалогов</p>
            ) : (
              <div className="divide-y divide-olive/5">
                {chats.map((chat) => {
                  const isWaiting = chat.lastMessage?.senderType === "user";
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChatId(chat.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream/80",
                        selectedChatId === chat.id && "bg-primary/5",
                      )}
                    >
                      {chat.user.avatarUrl ? (
                        <img src={chat.user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="h-9 w-9 shrink-0 text-olive/20" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium text-olive">
                            {chat.user.firstName} {chat.user.lastName}
                          </p>
                          {isWaiting && (
                            <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <p className="truncate text-xs text-olive/40">
                          {chat.lastMessage?.text ?? "—"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat detail */}
          <div
            className={cn(
              "flex flex-1 flex-col",
              selectedChatId ? "block" : "hidden md:flex",
            )}
          >
            {!selectedChatId || !chatDetail ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-olive/30">Выберите диалог</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 border-b border-olive/5 px-4 py-3">
                  <button
                    onClick={() => { setSelectedChatId(null); setChatDetail(null); }}
                    className="md:hidden"
                  >
                    <ChevronLeft className="h-5 w-5 text-olive/50" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-olive">
                      {chatDetail.user.firstName} {chatDetail.user.lastName}
                    </p>
                    <p className="text-xs text-olive/40">{chatDetail.user.phone}</p>
                  </div>
                  <button
                    onClick={() => deleteChat(chatDetail.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-cream/50 px-4 py-4">
                  {chatDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.senderType === "user" ? "justify-start" : "justify-end",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.senderType === "user"
                            ? "rounded-bl-md border border-olive/8 bg-white text-olive"
                            : "rounded-br-md bg-primary text-white",
                        )}
                      >
                        {msg.senderType === "moderator" && msg.senderName && (
                          <p className="mb-1 text-xs font-semibold text-white/70">{msg.senderName}</p>
                        )}
                        {msg.imageUrl && (
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                            <img src={msg.imageUrl} alt="" className="mb-1.5 max-h-48 rounded-lg object-cover" />
                          </a>
                        )}
                        {msg.text.trim() && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                        <p
                          className={cn(
                            "mt-1 text-right text-[10px]",
                            msg.senderType === "user" ? "text-olive/30" : "text-white/50",
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

                {/* Reply form */}
                <form onSubmit={handleSendReply} className="border-t border-olive/8 bg-white px-3 py-3">
                  {/* Manager selector */}
                  {managers.length > 0 && (
                    <div className="mb-2">
                      <select
                        value={replyManagerId}
                        onChange={(e) => setReplyManagerId(e.target.value)}
                        className="w-full rounded-lg border border-olive/10 bg-cream px-2.5 py-1.5 text-xs text-olive outline-none focus:border-primary/30"
                      >
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.isActive ? "(активный)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    {/* Emoji */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmoji((v) => !v)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-olive/35 hover:bg-olive/5 hover:text-olive/60"
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                      {showEmoji && (
                        <div className="absolute bottom-full left-0 mb-2 grid grid-cols-5 gap-1 rounded-xl border border-olive/8 bg-white p-2 shadow-lg">
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-olive/5"
                              onClick={() => {
                                setReplyText((t) => t + emoji);
                                setShowEmoji(false);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
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
                      placeholder="Ответить..."
                      rows={1}
                      className="max-h-[100px] min-h-[36px] flex-1 resize-none rounded-[22px] border border-olive/10 bg-cream px-4 py-2 text-sm text-olive outline-none placeholder:text-olive/30 focus:border-primary/30"
                    />

                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                      {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
