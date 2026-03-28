"use client";

// Client component for excursion faq in the excursions module.
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import type { FaqItem } from "@/types/excursions";

type ExcursionFaqProps = {
  items: FaqItem[];
};

export function ExcursionFaq({ items }: ExcursionFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
              isOpen
                ? "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
                : "border-olive/8 bg-cream/50 hover:bg-cream/80"
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <span
                className={`break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere] transition-colors ${
                  isOpen ? "text-primary" : "text-olive"
                }`}
              >
                {item.q}
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  isOpen ? "rotate-180 bg-primary/12 text-primary" : "bg-olive/6 text-olive/50"
                }`}
              >
                <AppIcon icon={ChevronDown} className="h-4 w-4" />
              </span>
            </button>

            {/* Smooth height animation using CSS grid */}
            <div
              className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="border-t border-olive/8 px-5 py-4">
                  <p className="break-words text-sm leading-relaxed text-olive/75 [overflow-wrap:anywhere]">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
