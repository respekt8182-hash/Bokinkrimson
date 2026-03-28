// Reusable UI helper/component for app icon.
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/cn";

export const APP_ICON_STROKE_WIDTH = 1.65;

const explicitTonePattern = /\b(?:text-|fill-|stroke-)/;

type AppIconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  filled?: boolean;
  fillStyle?: "soft" | "solid";
};

export function AppIcon({
  icon: Icon,
  className,
  filled = false,
  fillStyle = "soft",
  strokeWidth = APP_ICON_STROKE_WIDTH,
  absoluteStrokeWidth = true,
  fill: fillProp,
  ...rest
}: AppIconProps) {
  const hasExplicitTone =
    (typeof className === "string" && explicitTonePattern.test(className)) ||
    rest.color !== undefined ||
    rest.stroke !== undefined ||
    fillProp !== undefined;

  const resolvedFill = filled ? "currentColor" : (fillProp ?? "none");

  return (
    <Icon
      className={cn("app-icon shrink-0", className)}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={absoluteStrokeWidth}
      fill={resolvedFill}
      shapeRendering="geometricPrecision"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-tone={hasExplicitTone ? "custom" : "auto"}
      data-filled={filled ? "true" : "false"}
      data-fill-style={filled ? fillStyle : undefined}
      aria-hidden={rest["aria-hidden"] ?? true}
      {...rest}
    />
  );
}

export type { LucideIcon };
