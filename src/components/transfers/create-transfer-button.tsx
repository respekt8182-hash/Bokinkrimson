"use client";

import { Car, Plus, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";

type CreateTransferButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full gap-1.5">
      <AppIcon icon={Plus} className="h-4 w-4" />
      {pending ? "Создание..." : "Создать карточку трансфера"}
    </Button>
  );
}

export function CreateTransferButton({ action }: CreateTransferButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isQueryModalOpen = searchParams.get("create") === "1";
  const isModalVisible = isModalOpen || isQueryModalOpen;

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);

    if (searchParams.get("create") === "1") {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("create");
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }

  return (
    <div className="w-full min-[420px]:w-auto">
      <Button onClick={openModal} className="w-full justify-center gap-1.5 min-[420px]:w-auto">
        <AppIcon icon={Plus} className="h-4 w-4" />
        Добавить трансфер
      </Button>

      {isModalVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-olive/15 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl text-olive">Новый трансфер</h3>
                <p className="mt-1 text-sm text-olive/75">
                  Создайте карточку трансфера и заполните маршрут, автопарк, цены и контакты.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/20 text-olive hover:bg-cream"
                aria-label="Закрыть"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-olive/12 bg-cream/60 p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <AppIcon icon={Car} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-olive">Карточка трансфера</p>
                  <p className="mt-1 text-xs leading-relaxed text-olive/60">
                    Черновик откроется сразу после создания. Данные владельца подставятся из
                    профиля, остальное можно заполнить в редакторе.
                  </p>
                </div>
              </div>
            </div>

            <form action={action} className="mt-4">
              <SubmitButton />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
