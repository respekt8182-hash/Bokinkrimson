// UI component for register form in the forms module.
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/phone-input";
import { registerSchema } from "@/lib/schemas/auth";

// The form schema without phone (phone is handled separately via PhoneInput)
const formFieldsSchema = z.object({
  firstName: z.string().trim().min(2, "Имя должно содержать минимум 2 символа"),
  lastName: z.string().trim().min(2, "Фамилия должна содержать минимум 2 символа"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
  confirmPassword: z.string().min(8, "Подтвердите пароль"),
  personalDataConsent: z
    .boolean()
    .refine((value) => value === true, "Дайте согласие на обработку персональных данных"),
  marketingConsent: z.boolean().optional(),
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
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

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
      personalDataConsent: false,
      marketingConsent: false,
    },
  });

  const onSubmit = async (values: FormFieldsValues) => {
    setServerError("");
    setPhoneError("");

    const fullPhone = phoneValue.countryCode + phoneValue.phone;
    const fullParsed = registerSchema.safeParse({
      ...values,
      phone: fullPhone,
      personalDataConsent: values.personalDataConsent,
      marketingConsent: Boolean(values.marketingConsent),
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
        personalDataConsent: values.personalDataConsent,
        marketingConsent: Boolean(values.marketingConsent),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-olive/82">
            Имя
          </label>
          <Input
            id="firstName"
            autoComplete="given-name"
            placeholder="Введите имя"
            className="h-11 border-olive/14 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:ring-primary/18"
            {...register("firstName")}
          />
          {errors.firstName ? (
            <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-olive/82">
            Фамилия
          </label>
          <Input
            id="lastName"
            autoComplete="family-name"
            placeholder="Введите фамилию"
            className="h-11 border-olive/14 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:ring-primary/18"
            {...register("lastName")}
          />
          {errors.lastName ? (
            <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-olive/82">
          Телефон
        </label>
        <PhoneInput
          id="phone"
          value={phoneValue}
          onChange={setPhoneValue}
          hasError={!!phoneError}
          className="h-11"
        />
        {phoneError ? <p className="mt-1 text-xs text-red-600">{phoneError}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-olive/82">
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
            className="h-11 border-olive/14 px-4 pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:ring-primary/18"
          />
          <button
            type="button"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
            title={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
            className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary/72 transition hover:bg-cream hover:text-primary"
          >
            <AppIcon icon={isPasswordVisible ? EyeOff : Eye} className="h-4 w-4" />
          </button>
        </div>
        {errors.password ? (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-olive/82">
          Повторите пароль
        </label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={isConfirmPasswordVisible ? "text" : "password"}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...register("confirmPassword")}
            className="h-11 border-olive/14 px-4 pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:ring-primary/18"
          />
          <button
            type="button"
            onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
            aria-label={isConfirmPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
            title={isConfirmPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
            className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary/72 transition hover:bg-cream hover:text-primary"
          >
            <AppIcon icon={isConfirmPasswordVisible ? EyeOff : Eye} className="h-4 w-4" />
          </button>
        </div>
        {errors.confirmPassword ? (
          <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-2xl border border-olive/10 bg-cream/55 p-3 text-sm leading-5 text-olive/72">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            {...register("personalDataConsent")}
          />
          <span>
            Даю согласие на обработку персональных данных на условиях{" "}
            <Link
              href="/legal/personal-data-consent"
              target="_blank"
              className="font-semibold text-terra hover:underline"
            >
              Согласия на обработку персональных данных
            </Link>
            .
          </span>
        </label>
        {errors.personalDataConsent ? (
          <p className="text-xs text-red-600">{errors.personalDataConsent.message}</p>
        ) : null}

        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" {...register("marketingConsent")} />
          <span>
            Согласен получать информационные и рекламные сообщения по указанным контактным данным.
            Это необязательно и не влияет на регистрацию.
          </span>
        </label>
      </div>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <Button
        type="submit"
        className="h-11 w-full rounded-xl bg-gradient-to-b from-[#19b8b2] to-primary shadow-[0_14px_28px_-18px_rgba(15,118,110,0.8)] hover:brightness-100 hover:from-[#21c6bf] hover:to-[#0d837a]"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Создание..." : "Создать аккаунт"}
      </Button>
    </form>
  );
}
