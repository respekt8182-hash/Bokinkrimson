// Next.js page for route /legal/privacy.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика обработки персональных данных сервиса Крым Вокруг.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <article className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
        <h1 className="text-3xl text-olive">Политика конфиденциальности</h1>
        <p className="mt-3 text-sm leading-6 text-olive/80">
          Мы обрабатываем только необходимые данные для работы сервиса: учетные данные пользователя,
          сведения об объектах/экскурсиях, заявки и отзывы.
        </p>
        <p className="mt-2 text-sm leading-6 text-olive/80">
          Данные используются для предоставления функционала платформы, связи между гостями и
          владельцами, а также для модерации и обеспечения безопасности.
        </p>
        <p className="mt-2 text-sm leading-6 text-olive/80">
          По запросу пользователя учетные данные могут быть удалены, если это не противоречит
          действующему законодательству и обязательствам хранения.
        </p>
      </article>
    </div>
  );
}
