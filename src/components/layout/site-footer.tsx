// UI component for site footer in the layout module.
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-olive/10 bg-sand/55">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-olive/70 md:px-6">
        <p className="text-base font-semibold text-olive">Крым вокруг - сервис размещения у моря</p>
        <p className="mt-1 text-xs text-olive/70">krymvokrug.ru • для гостей, владельцев и организаторов</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link href="/legal/terms" className="hover:text-olive">
            Пользовательское соглашение
          </Link>
          <Link href="/legal/privacy" className="hover:text-olive">
            Политика конфиденциальности
          </Link>
          <Link href="/cooperation" className="hover:text-olive">
            Сотрудничество
          </Link>
          <Link href="#" className="hover:text-olive">
            Партнёрам
          </Link>
          <Link href="#" className="hover:text-olive">
            Служебная ссылка
          </Link>
        </div>
      </div>
    </footer>
  );
}
