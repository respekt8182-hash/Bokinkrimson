// UI component for logout button in the auth module.
"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  };

  return (
    <Button variant="ghost" onClick={onClick} disabled={isPending}>
      {isPending ? "Выход..." : "Выйти"}
    </Button>
  );
}
