// Global error boundary UI for unexpected runtime failures.
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global route error", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-olive/10">
        <h1 className="text-3xl text-olive">Произошла ошибка</h1>
        <p className="mt-2 text-sm text-olive/75">
          Не удалось загрузить страницу. Попробуйте еще раз.
        </p>
        <div className="mt-4">
          <Button onClick={reset}>Повторить</Button>
        </div>
      </section>
    </div>
  );
}
