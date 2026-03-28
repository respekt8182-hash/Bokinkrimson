// YooKassa webhook endpoint that verifies provider state and syncs local payment/property status.
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPlacementValidUntil,
  mapYookassaStatus,
  resolvePaymentStatusTransition,
  type YookassaStatus,
} from "@/lib/payments";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";
import { getYookassaPayment, isYookassaConfigured } from "@/lib/yookassa";

const webhookSchema = z.object({
  event: z.string().optional(),
  object: z
    .object({
      id: z.string(),
      status: z.enum(["pending", "waiting_for_capture", "succeeded", "canceled"]).optional(),
      confirmation: z
        .object({
          confirmation_url: z.string().url().optional(),
        })
        .optional(),
    })
    .passthrough(),
});

function resolveStatusFromEvent(event: string | undefined): YookassaStatus | null {
  const value = (event ?? "").toLowerCase();

  if (value.includes("succeeded")) {
    return "succeeded";
  }

  if (value.includes("canceled")) {
    return "canceled";
  }

  if (value.includes("waiting_for_capture")) {
    return "waiting_for_capture";
  }

  if (value.includes("pending")) {
    return "pending";
  }

  return null;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный формат webhook" }, { status: 400 });
  }

  const providerPaymentId = parsed.data.object.id;

  const existing = await db.payment.findFirst({
    where: {
      provider: PaymentProvider.YOOKASSA,
      providerPaymentId,
    },
    include: {
      property: {
        select: {
          status: true,
          pendingEditStatus: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ ok: true, ignored: "payment_not_found" });
  }

  let providerSnapshot: Awaited<ReturnType<typeof getYookassaPayment>> | null = null;

  if (isYookassaConfigured()) {
    try {
      providerSnapshot = await getYookassaPayment(providerPaymentId);
    } catch (error) {
      logger.error("Failed to verify YooKassa payment via API", {
        providerPaymentId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const rawStatus =
    providerSnapshot?.status ??
    parsed.data.object.status ??
    resolveStatusFromEvent(parsed.data.event) ??
    "pending";

  const nextStatus = resolvePaymentStatusTransition(existing.status, mapYookassaStatus(rawStatus));
  const nextConfirmationUrl =
    providerSnapshot?.confirmation?.confirmation_url ??
    parsed.data.object.confirmation?.confirmation_url ??
    existing.confirmationUrl;
  const providerPayload = JSON.parse(
    JSON.stringify({
      webhook: parsed.data,
      verified: providerSnapshot,
    }),
  ) as Prisma.InputJsonValue;

  const shouldUpdate =
    nextStatus !== existing.status ||
    nextConfirmationUrl !== existing.confirmationUrl ||
    existing.providerPayload === null;

  if (!shouldUpdate) {
    if (nextStatus === PaymentStatus.SUCCEEDED) {
      await autoSubmitPropertyAfterSuccessfulPayment(db, existing.propertyId);
    }

    return NextResponse.json({ ok: true, updated: false });
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        confirmationUrl: nextConfirmationUrl,
        providerPayload,
        paidAt:
          nextStatus === PaymentStatus.SUCCEEDED
            ? (existing.paidAt ?? new Date())
            : existing.paidAt,
        canceledAt:
          nextStatus === PaymentStatus.CANCELED
            ? (existing.canceledAt ?? new Date())
            : existing.canceledAt,
        placementValidUntil:
          nextStatus === PaymentStatus.SUCCEEDED
            ? (existing.placementValidUntil ?? getPlacementValidUntil(new Date()))
            : existing.placementValidUntil,
      },
      include: {
        property: {
          select: {
            status: true,
            pendingEditStatus: true,
          },
        },
      },
    });

    if (updated.status === PaymentStatus.SUCCEEDED) {
      await autoSubmitPropertyAfterSuccessfulPayment(tx, existing.propertyId);
    }
  });

  return NextResponse.json({ ok: true, updated: true });
}
