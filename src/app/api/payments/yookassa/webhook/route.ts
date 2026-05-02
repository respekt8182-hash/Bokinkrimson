// YooKassa webhook endpoint that verifies provider state and syncs local payment/property status.
import { createHash } from "crypto";
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPlacementValidUntil,
  getTransferPaymentReference,
  mapYookassaStatus,
  resolvePaymentStatusTransition,
  type YookassaStatus,
} from "@/lib/payments";
import { db, type DbClientLike } from "@/lib/db";
import { autoSubmitExcursionAfterSuccessfulPayment } from "@/lib/excursions";
import { logger } from "@/lib/logger";
import { autoSubmitPropertyAfterSuccessfulPayment } from "@/lib/properties";
import {
  autoSubmitTransferAfterSuccessfulPayment,
  submitTransferToModerationIfReady,
} from "@/lib/transfers";
import {
  getYookassaPayment,
  isTrustedYookassaWebhookSource,
  isYookassaConfigured,
} from "@/lib/yookassa";

const webhookSchema = z.object({
  event: z.string().optional(),
  object: z
    .object({
      id: z.string(),
      confirmation: z
        .object({
          confirmation_url: z.string().url().optional(),
        })
        .optional(),
    })
    .passthrough(),
});

function buildWebhookFingerprint(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

async function createWebhookReceipt(input: {
  fingerprint: string;
  providerEventId: string | null;
  providerPaymentId: string;
  localPaymentId: string | null;
  outcome: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<"created" | "duplicate"> {
  try {
    await db.webhookReceipt.create({
      data: {
        provider: PaymentProvider.YOOKASSA,
        fingerprint: input.fingerprint,
        providerEventId: input.providerEventId,
        providerPaymentId: input.providerPaymentId,
        localPaymentId: input.localPaymentId,
        outcome: input.outcome,
        metadata: input.metadata,
      },
    });

    return "created";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "duplicate";
    }

    throw error;
  }
}

async function autoSubmitTransferForPayment(
  client: DbClientLike,
  payment: {
    transferId?: string | null;
    tariffCode?: string | null;
    providerPayload?: unknown;
  },
) {
  const transferReference = getTransferPaymentReference({
    transferId: payment.transferId,
    tariffCode: payment.tariffCode,
    providerPayload: payment.providerPayload,
  });

  if (!transferReference) {
    return;
  }

  if (payment.transferId) {
    await autoSubmitTransferAfterSuccessfulPayment(client, payment.transferId);
    return;
  }

  await submitTransferToModerationIfReady(client, transferReference.transferId);
}

export async function POST(request: Request) {
  if (!isTrustedYookassaWebhookSource(request)) {
    logger.warn("Rejected YooKassa webhook from untrusted source");
    return NextResponse.json({ error: "Webhook source is not trusted" }, { status: 403 });
  }

  if (!isYookassaConfigured()) {
    logger.error("Rejected YooKassa webhook because provider configuration is missing");
    return NextResponse.json({ error: "Payment provider is unavailable" }, { status: 503 });
  }

  const rawBody = await request.text();
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const providerEventId = parsed.data.event ?? null;
  const providerPaymentId = parsed.data.object.id;
  const fingerprint = buildWebhookFingerprint(rawBody);

  let providerSnapshot: Awaited<ReturnType<typeof getYookassaPayment>>;

  try {
    providerSnapshot = await getYookassaPayment(providerPaymentId);
  } catch (error) {
    logger.error("Failed to verify YooKassa payment via API", {
      providerPaymentId,
      providerEventId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Payment verification is temporarily unavailable" },
      { status: 503 },
    );
  }

  if (providerSnapshot.id !== providerPaymentId) {
    logger.warn("YooKassa verification returned mismatched payment id", {
      providerPaymentId,
      verifiedPaymentId: providerSnapshot.id,
      providerEventId,
    });
    return NextResponse.json({ error: "Payment verification mismatch" }, { status: 409 });
  }

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

  const receiptStatus = await createWebhookReceipt({
    fingerprint,
    providerEventId,
    providerPaymentId,
    localPaymentId: existing?.id ?? null,
    outcome: existing ? "verified" : "payment_not_found",
    metadata: {
      event: providerEventId,
      verifiedStatus: providerSnapshot.status,
    },
  });

  if (receiptStatus === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (!existing) {
    logger.info("Ignoring verified YooKassa webhook for unknown local payment", {
      providerPaymentId,
      providerEventId,
      verifiedStatus: providerSnapshot.status,
    });
    return NextResponse.json({ ok: true, ignored: "payment_not_found" });
  }

  const nextStatus = resolvePaymentStatusTransition(
    existing.status,
    mapYookassaStatus(providerSnapshot.status as YookassaStatus),
  );
  const nextConfirmationUrl =
    providerSnapshot.confirmation?.confirmation_url ?? existing.confirmationUrl;
  const providerPayload = JSON.parse(
    JSON.stringify({
      verified: providerSnapshot,
      receivedEvent: providerEventId,
      receivedObjectId: providerPaymentId,
    }),
  ) as Prisma.InputJsonValue;

  const shouldUpdate =
    nextStatus !== existing.status ||
    nextConfirmationUrl !== existing.confirmationUrl ||
    existing.providerPayload === null;

  if (!shouldUpdate) {
    if (nextStatus === PaymentStatus.SUCCEEDED && existing.propertyId) {
      await autoSubmitPropertyAfterSuccessfulPayment(db, existing.propertyId);
    }
    if (nextStatus === PaymentStatus.SUCCEEDED && existing.excursionId) {
      await autoSubmitExcursionAfterSuccessfulPayment(db, existing.excursionId);
    }
    if (nextStatus === PaymentStatus.SUCCEEDED) {
      await autoSubmitTransferForPayment(db, existing);
    }

    await db.webhookReceipt.update({
      where: {
        provider_fingerprint: {
          provider: PaymentProvider.YOOKASSA,
          fingerprint,
        },
      },
      data: {
        outcome: "noop",
      },
    });

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
          nextStatus === PaymentStatus.SUCCEEDED && existing.propertyId
            ? (existing.placementValidUntil ?? getPlacementValidUntil(new Date()))
            : existing.placementValidUntil,
      },
    });

    if (updated.status === PaymentStatus.SUCCEEDED && updated.propertyId) {
      await autoSubmitPropertyAfterSuccessfulPayment(tx, updated.propertyId);
    }
    if (updated.status === PaymentStatus.SUCCEEDED && updated.excursionId) {
      await autoSubmitExcursionAfterSuccessfulPayment(tx, updated.excursionId);
    }
    if (updated.status === PaymentStatus.SUCCEEDED) {
      await autoSubmitTransferForPayment(tx, existing);
    }

    await tx.webhookReceipt.update({
      where: {
        provider_fingerprint: {
          provider: PaymentProvider.YOOKASSA,
          fingerprint,
        },
      },
      data: {
        outcome: "processed",
        localPaymentId: updated.id,
        metadata: {
          event: providerEventId,
          verifiedStatus: providerSnapshot.status,
          paymentStatus: updated.status,
        },
      },
    });
  });

  logger.info("Processed verified YooKassa webhook", {
    paymentId: existing.id,
    providerPaymentId,
    providerEventId,
    status: nextStatus,
  });

  return NextResponse.json({ ok: true, updated: true });
}
