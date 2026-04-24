import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  return (
    <div>
      <h1 className="text-3xl text-olive">Новый пароль</h1>
      <p className="mt-2 text-sm text-olive/70">
        Задайте новый пароль для входа в личный кабинет.
      </p>
      <div className="mt-5">
        <ResetPasswordForm initialToken={token} />
      </div>
      <p className="mt-4 text-sm text-olive/70">
        <Link href="/auth/login" className="font-semibold text-terra hover:underline">
          Вернуться ко входу
        </Link>
      </p>
    </div>
  );
}
