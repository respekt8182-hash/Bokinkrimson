// Next.js page for route /auth/forgot-password.
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-3xl text-olive">Восстановление пароля</h1>
      <p className="mt-2 text-sm text-olive/70">
        Укажите номер телефона аккаунта. Администратор обработает запрос и свяжется с вами.
      </p>
      <div className="mt-5">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-olive/70">
        <Link href="/auth/login" className="font-semibold text-terra hover:underline">
          Вернуться ко входу
        </Link>
      </p>
    </div>
  );
}
