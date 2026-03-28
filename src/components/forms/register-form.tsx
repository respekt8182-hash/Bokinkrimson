// UI component for register form in the forms module.
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/phone-input";
import { registerSchema } from "@/lib/schemas";

// The form schema without phone (phone is handled separately via PhoneInput)
const formFieldsSchema = z.object({
  firstName: z.string().trim().min(2, "Имя должно содержать минимум 2 символа"),
  lastName: z.string().trim().min(2, "Фамилия должна содержать минимум 2 символа"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
  confirmPassword: z.string().min(8, "Подтвердите пароль"),
});

type FormFieldsValues = z.infer<typeof formFieldsSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({
    countryCode: "+7",
    phone: "",
  });
  const [phoneError, setPhoneError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFieldsValues>({
    resolver: zodResolver(formFieldsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: FormFieldsValues) => {
    setServerError("");
    setPhoneError("");

    const fullPhone = phoneValue.countryCode + phoneValue.phone;
    const fullParsed = registerSchema.safeParse({
      ...values,
      phone: fullPhone,
    });

    if (!fullParsed.success) {
      const fieldErrors = fullParsed.error.flatten().fieldErrors;
      if (fieldErrors.phone?.[0]) {
        setPhoneError(fieldErrors.phone[0]);
      }
      if (fieldErrors.confirmPassword?.[0]) {
        // password mismatch is handled by refine, set as server error
        setServerError(fieldErrors.confirmPassword[0]);
      }
      return;
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: fullPhone,
        password: values.password,
        confirmPassword: values.confirmPassword,
      }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setServerError(body.error ?? "Ошибка регистрации");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-olive">
            Имя
          </label>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          {errors.firstName ? (
            <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-olive">
            Фамилия
          </label>
          <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          {errors.lastName ? (
            <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>

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

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-olive">
          Пароль
        </label>
        <div className="relative">
          <Input
            id="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...register("password")}
            className="pr-28"
          />
          <button
            type="button"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs font-semibold text-olive/70 transition hover:bg-cream"
          >
            {isPasswordVisible ? "Скрыть" : "Показать"}
          </button>
        </div>
        {errors.password ? (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-olive">
          Повторите пароль
        </label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Создание..." : "Создать аккаунт"}
      </Button>
    </form>
  );
}
