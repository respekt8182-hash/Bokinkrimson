"use client";

// Client component for pricing tiers editor in the excursions module.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PricingTier } from "@/types/excursions";

type PricingTiersEditorProps = {
  tiers: PricingTier[];
  onChange: (tiers: PricingTier[]) => void;
};

export function PricingTiersEditor({ tiers, onChange }: PricingTiersEditorProps) {
  function addTier() {
    onChange([...tiers, { label: "", price: 0 }]);
  }

  function removeTier(index: number) {
    onChange(tiers.filter((_, i) => i !== index));
  }

  function updateTier(index: number, key: keyof PricingTier, value: string | number) {
    onChange(tiers.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  }

  return (
    <div className="space-y-2">
      {tiers.length === 0 && (
        <p className="text-sm text-[color:var(--text-muted)]">
          Добавьте ценовые категории (например, взрослый / ребёнок / группа)
        </p>
      )}

      {tiers.map((tier, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={tier.label}
            onChange={(e) => updateTier(index, "label", e.target.value)}
            placeholder="Категория (напр. «Взрослый»)"
            maxLength={60}
            className="flex-1"
          />
          <div className="relative flex w-32 shrink-0 items-center">
            <Input
              type="number"
              value={tier.price === 0 ? "" : tier.price}
              onChange={(e) => updateTier(index, "price", parseInt(e.target.value) || 0)}
              placeholder="0"
              min={0}
              max={1000000}
              className="pr-8"
            />
            <span className="pointer-events-none absolute right-3 text-sm text-[color:var(--text-muted)]">
              ₽
            </span>
          </div>
          <button
            type="button"
            onClick={() => removeTier(index)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] text-sm text-[color:var(--danger)] hover:bg-red-50"
            title="Удалить"
          >
            ✕
          </button>
        </div>
      ))}

      {tiers.length < 10 && (
        <Button type="button" variant="ghost" onClick={addTier} className="w-full border-dashed">
          + Добавить категорию
        </Button>
      )}
    </div>
  );
}
