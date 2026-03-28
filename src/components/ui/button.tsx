// UI component for button in the ui module.
import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--primary)] text-white shadow-[var(--shadow)] hover:brightness-95",
  secondary:
    "bg-[color:var(--secondary)] text-[color:var(--text)] hover:brightness-95",
  ghost:
    "bg-transparent text-[color:var(--text)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--primary)] hover:text-white",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
});
