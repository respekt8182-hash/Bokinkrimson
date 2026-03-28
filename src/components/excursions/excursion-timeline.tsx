"use client";

// Client component for excursion timeline in the excursions module.
import { Clock3, MapPin } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { TimelineStepIcon } from "@/components/ui/timeline-step-icon";
import type { TimelineStep } from "@/types/excursions";

type ExcursionTimelineProps = {
  steps: TimelineStep[];
};

export function ExcursionTimeline({ steps }: ExcursionTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <ol className="relative space-y-0 pl-10">
      {/* Gradient vertical line */}
      <div
        aria-hidden="true"
        className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"
      />

      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <li key={index} className={`relative flex gap-5 ${isLast ? "" : "pb-7"}`}>
            {/* Step circle */}
            <div className="absolute -left-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-gradient-to-br from-primary/15 to-primary/8 text-sm shadow-[0_0_0_4px_rgba(15,118,110,0.06)]">
              {step.icon ? (
                <TimelineStepIcon icon={step.icon} className="h-4 w-4 text-primary" />
              ) : (
                <span className="text-[11px] font-bold text-primary">{step.step}</span>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              {/* Time + duration badges */}
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {step.time && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary ring-1 ring-primary/12">
                    <AppIcon icon={Clock3} className="h-3 w-3 opacity-70" />
                    {step.time}
                  </span>
                )}
                {step.duration && (
                  <span className="rounded-full bg-sand/80 px-2.5 py-1 text-xs text-olive/60 ring-1 ring-olive/8">
                    {step.duration}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4 className="text-base font-semibold leading-snug text-olive">{step.title}</h4>

              {/* Location */}
              {step.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-terra/70">
                  <AppIcon icon={MapPin} className="h-3 w-3 shrink-0" />
                  {step.location}
                </p>
              )}

              {/* Description */}
              {step.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-olive/65">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
