"use client";

// Client component for faq editor in the excursions module.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FaqItem } from "@/types/excursions";

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
        <p className="text-sm text-[color:var(--text-muted)]">
          Добавьте часто задаваемые вопросы и ответы на них.
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-2 rounded-xl border border-[color:var(--border)] bg-white p-3"
        >
          <div className="flex items-start gap-2">
            <span className="mt-2.5 shrink-0 text-xs font-bold text-[color:var(--primary)]">Q</span>
            <div className="flex-1 space-y-1">
              <Input
                value={item.q}
                onChange={(event) => updateItem(index, "q", event.target.value)}
                placeholder="Вопрос"
                maxLength={questionMaxLength}
                className="flex-1"
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
              className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] text-xs text-[color:var(--danger)] transition hover:bg-red-50"
              title="Удалить"
            >
              x
            </button>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-2.5 shrink-0 text-xs font-bold text-[color:var(--text-muted)]">A</span>
            <div className="flex-1 space-y-1">
              <textarea
                value={item.a}
                onChange={(event) => updateItem(index, "a", event.target.value)}
                placeholder="Ответ"
                maxLength={answerMaxLength}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-[color:var(--border)] px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20"
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
        <Button type="button" variant="ghost" onClick={addItem} className="w-full border-dashed">
          + Добавить вопрос
        </Button>
      ) : null}
    </div>
  );
}
