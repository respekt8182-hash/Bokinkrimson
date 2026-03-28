// UI component for checkbox in the ui module.
import { cn } from "@/lib/cn";
import { type InputHTMLAttributes } from "react";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 rounded border-olive/30 text-primary focus:ring-primary/35", className)}
      {...props}
    />
  );
}
