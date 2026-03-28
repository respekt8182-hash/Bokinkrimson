// UI component for input in the ui module.
import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, suppressHydrationWarning = true, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      suppressHydrationWarning={suppressHydrationWarning}
      className={cn(
        "w-full rounded-xl border border-olive/18 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/48 focus:border-primary focus:ring-2 focus:ring-primary/22",
        className,
      )}
      {...props}
    />
  );
});
