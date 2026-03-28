// UI component for forgot password form in the forms module.
"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/phone-input";
import { forgotPasswordSchema } from "@/lib/schemas";

export function ForgotPasswordForm() {
  const [isDone, setIsDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({
    countryCode: "+7",
    phone: "",
  });
  const [phoneError, setPhoneError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerError("");
      setPhoneError("");

      const fullPhone = phoneValue.countryCode + phoneValue.phone;
      const parsed = forgotPasswordSchema.safeParse({ phone: fullPhone });

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        if (fieldErrors.phone?.[0]) setPhoneError(fieldErrors.phone[0]);
        return;
      }

      setIsSubmitting(true);

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setServerError(body.error ?? "Не удалось отправить запрос");
        setIsSubmitting(false);
        return;
      }

      setIsDone(true);
      setIsSubmitting(false);
    },
    [phoneValue],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-olive">
          Телефон
        </label>
        <PhoneInput
          id="phone"
          value={phoneValue}
          onChange={setPhoneValue}
          hasError={!!phoneError}
        />
        {phoneError ? <p className="mt-1 text-xs text-red-600">{phoneError}</p> : null}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Отправка..." : "Восстановить пароль"}
      </Button>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      {isDone ? (
        <p className="rounded-lg bg-sage/25 px-3 py-2 text-sm text-olive">
          Запрос принят. Скоро администратор свяжется с вами для восстановления доступа.
        </p>
      ) : null}
    </form>
  );
}
