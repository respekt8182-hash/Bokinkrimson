"use client";

// Client component for included editor in the excursions module.
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type IncludedEditorProps = {
  items: string[];
  onChange: (items: string[]) => void;
  presets: string[];
  placeholder?: string;
};

export function IncludedEditor({
  items,
  onChange,
  presets,
  placeholder = "Добавить пункт...",
}: IncludedEditorProps) {
  const [inputValue, setInputValue] = useState("");

  function addItem(value: string) {
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setInputValue("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function togglePreset(preset: string) {
    if (items.includes(preset)) {
      onChange(items.filter((item) => item !== preset));
    } else {
      onChange([...items, preset]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem(inputValue);
    }
  }

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => togglePreset(preset)}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-medium transition",
              items.includes(preset)
                ? "border-[color:var(--primary)] bg-[color:var(--foam)] text-[color:var(--primary)]"
                : "border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)]/50",
            )}
          >
            {items.includes(preset) ? "✓ " : "+ "}
            {preset}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={100}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => addItem(inputValue)}
          disabled={!inputValue.trim()}
          className="shrink-0"
        >
          Добавить
        </Button>
      </div>

      {/* Added items list */}
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
            >
              <span className="text-[color:var(--text)]">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="ml-2 shrink-0 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--danger)]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
