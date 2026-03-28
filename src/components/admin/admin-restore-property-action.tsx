// UI component for admin restore property action in the admin module.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type AdminRestorePropertyActionProps = {
  propertyId: string;
};

type RestorePropertyResponse = {
  error?: string;
  item?: {
    restoredAt: string;
  };
};

export function AdminRestorePropertyAction({ propertyId }: AdminRestorePropertyActionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function restore() {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/properties/${propertyId}/restore`, {
        method: "POST",
      });

      const body = (await response.json()) as RestorePropertyResponse;

      if (!response.ok) {
        setError(body.error ?? "Не удалось восстановить объект");
        return;
      }

      const restoredAt = body.item?.restoredAt
        ? new Date(body.item.restoredAt).toLocaleString("ru-RU")
        : null;
      setSuccess(restoredAt ? `Объект восстановлен (${restoredAt})` : "Объект восстановлен");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => void restore()}
        disabled={isSubmitting}
        className="bg-terra text-white hover:bg-terra/88"
      >
        {isSubmitting ? "Восстановление..." : "Восстановить объект"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-green-700">{success}</p> : null}
    </div>
  );
}
