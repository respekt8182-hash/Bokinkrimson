"use client";

// Client component for faq editor in the excursions module.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/components/ui/app-icon";
import type { FaqItem } from "@/types/excursions";
import { Plus, X } from "lucide-react";

type FaqEditorProps = {
  items: FaqItem[];
  onChange: (items: FaqItem[]) => void;
  maxItems?: number;
  questionMaxLength?: number;
  answerMaxLength?: number;
  showCounters?: boolean;
};

export function FaqEditor({
  items,
  onChange,
  maxItems = 20,
  questionMaxLength = 200,
  answerMaxLength = 1000,
  showCounters = false,
}: FaqEditorProps) {
  function addItem() {
    onChange([...items, { q: "", a: "" }]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, key: keyof FaqItem, value: string) {
    const nextValue =
      key === "q" ? value.slice(0, questionMaxLength) : value.slice(0, answerMaxLength);

    onChange(items.map((item, i) => (i === index ? { ...item, [key]: nextValue } : item)));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-primary/18 bg-white/75 px-3.5 py-3 text-sm text-olive/60">
          Добавьте часто задаваемые вопросы и ответы на них.
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-3 rounded-2xl border border-primary/10 bg-white/90 p-3 shadow-[0_10px_26px_-22px_rgba(15,74,64,0.34)]"
        >
          <div className="flex items-start gap-2 sm:gap-3">
            <span className="mt-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/12">
              Q
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <Input
                value={item.q}
                onChange={(event) => updateItem(index, "q", event.target.value)}
                placeholder="Вопрос"
                maxLength={questionMaxLength}
                className="flex-1 bg-white/95"
              />
              {showCounters ? (
                <p className="text-right text-[11px] tabular-nums text-olive/45">
                  {item.q.length}/{questionMaxLength}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-white text-[color:var(--danger)] transition hover:border-red-200 hover:bg-red-50"
              title="Удалить"
            >
              <AppIcon icon={X} className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <span className="mt-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-olive/6 text-xs font-bold text-olive/55 ring-1 ring-olive/10">
              A
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <textarea
                value={item.a}
                onChange={(event) => updateItem(index, "a", event.target.value)}
                placeholder="Ответ"
                maxLength={answerMaxLength}
                rows={2}
                className="min-h-[88px] w-full resize-y rounded-xl border border-olive/18 bg-white/95 px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/22"
              />
              {showCounters ? (
                <p className="text-right text-[11px] tabular-nums text-olive/45">
                  {item.a.length}/{answerMaxLength}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {items.length < maxItems ? (
        <Button
          type="button"
          variant="ghost"
          onClick={addItem}
          className="w-full gap-2 border border-dashed border-primary/18 bg-white/75 text-primary shadow-sm shadow-olive/5 hover:border-primary/30"
        >
          <AppIcon icon={Plus} className="h-4 w-4" />
          Добавить вопрос
        </Button>
      ) : null}
    </div>
  );
}
