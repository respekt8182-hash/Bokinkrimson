"use client";

// Reusable UI helper/component for sea toggle.
import { cn } from "@/lib/cn";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
} from "react";

type SeaToggleSize = "sm" | "md";

type SeaToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onChange"> & {
  pressed: boolean;
  onPressedChange?: (nextPressed: boolean) => void;
  size?: SeaToggleSize;
  trackOffColor?: string;
  trackOnColor?: string;
  accentColor?: string;
};

const sizeClasses: Record<SeaToggleSize, { track: string; knob: string; translate: string }> = {
  sm: {
    track: "h-[1.375rem] w-10 p-[2px]",
    knob: "h-[1.125rem] w-[1.125rem]",
    translate: "translate-x-[1.125rem]",
  },
  md: {
    track: "h-6 w-11 p-[2px]",
    knob: "h-5 w-5",
    translate: "translate-x-5",
  },
};

export function SeaToggle({
  pressed,
  onPressedChange,
  onClick,
  className,
  size = "md",
  trackOffColor,
  trackOnColor,
  style,
  type = "button",
  ...props
}: SeaToggleProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || props.disabled) {
      return;
    }
    onPressedChange?.(!pressed);
  }

  const cssVariables: CSSProperties & Record<`--${string}`, string | undefined> = {
    ...style,
    "--sea-track-off": trackOffColor,
    "--sea-track-on": trackOnColor,
  };

  const { track, knob, translate } = sizeClasses[size];

  return (
    <button
      type={type}
      className={cn(
        "sea-toggle inline-flex shrink-0 cursor-pointer items-center rounded-full focus:outline-none disabled:cursor-not-allowed disabled:opacity-55",
        track,
        className,
      )}
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      onClick={handleClick}
      style={cssVariables}
      {...props}
    >
      <span
        className={cn(
          "sea-toggle-knob pointer-events-none block rounded-full",
          knob,
          pressed ? translate : "translate-x-0",
        )}
      />
    </button>
  );
}
