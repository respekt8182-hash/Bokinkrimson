// Next.js page for route /legal/terms.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: "Условия использования сервиса Крым Вокруг.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <article className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
        <h1 className="text-3xl text-olive">Пользовательское соглашение</h1>
        <p className="mt-3 text-sm leading-6 text-olive/80">
          Пользователь обязуется предоставлять достоверную информацию и не размещать контент,
          нарушающий законодательство или права третьих лиц.
        </p>
        <p className="mt-2 text-sm leading-6 text-olive/80">
          Администратор сервиса вправе отклонять публикации, запрашивать правки и удалять отзывы или
          объявления, нарушающие правила площадки.
        </p>
        <p className="mt-2 text-sm leading-6 text-olive/80">
          Оплата размещения подтверждает согласие владельца с правилами публикации и модерации.
        </p>
      </article>
    </div>
  );
}
