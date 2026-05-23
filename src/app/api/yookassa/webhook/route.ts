import { PaymentProvider, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyProviderPaymentStatus } from "@/lib/payment-finalization";
import {
  appendYooKassaRefundPayload,
  getYooKassaPayment,
  getYooKassaRefund,
  mapYooKassaPaymentStatus,
  mergeYooKassaPaymentPayload,
  type YooKassaPayment,
} from "@/lib/yookassa";

export const dynamic = "force-dynamic";

const supportedEvents = new Set([
  "payment.succeeded",
  "payment.waiting_for_capture",
  "payment.canceled",
  "refund.succeeded",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getObjectId(payload: Record<string, unknown>): string | null {
  return isRecord(payload.object) ? getString(payload.object.id) : null;
}

function getMetadataLocalPaymentId(payment: YooKassaPayment): string | null {
  return getString(payment.metadata?.local_payment_id);
}

function getNotificationPaymentId(payload: Record<string, unknown>): string | null {
  if (!isRecord(payload.object) || !isRecord(payload.object.metadata)) {
    return null;
  }

  return getString(payload.object.metadata.local_payment_id);
}

function buildFingerprint(event: string, objectId: string, status: string | null): string {
  return createHash("sha256")
    .update(["yookassa", event, objectId, status ?? ""].join(":"))
    .digest("hex");
}

async function writeWebhookReceipt(input: {
  fingerprint: string;
  event: string;
  providerPaymentId?: string | null;
  localPaymentId?: string | null;
  outcome: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await db.webhookReceipt.create({
      data: {
        provider: "yookassa",
        fingerprint: input.fingerprint,
        providerEventId: input.event,
        providerPaymentId: input.providerPaymentId ?? null,
        localPaymentId: input.localPaymentId ?? null,
        outcome: input.outcome,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }

    throw error;
  }
}

async function findLocalYooKassaPayment(input: {
  providerPaymentId: string;
  localPaymentId?: string | null;
}) {
  const or: Prisma.PaymentWhereInput[] = [{ providerPaymentId: input.providerPaymentId }];
  if (input.localPaymentId) {
    or.push({ id: input.localPaymentId });
  }

  return db.payment.findFirst({
    where: {
      provider: PaymentProvider.YOOKASSA,
      OR: or,
    },
  });
}

async function processPaymentNotification(
  event: string,
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const notificationPaymentId = getObjectId(payload);
  if (!notificationPaymentId) {
    return NextResponse.json({ ok: false, error: "payment id is missing" }, { status: 400 });
  }

  const verifiedPayment = await getYooKassaPayment(notificationPaymentId);
  const localPaymentId =
    getMetadataLocalPaymentId(verifiedPayment) ?? getNotificationPaymentId(payload);
  const localPayment = await findLocalYooKassaPayment({
    providerPaymentId: verifiedPayment.id,
    localPaymentId,
  });
  const fingerprint = buildFingerprint(event, verifiedPayment.id, verifiedPayment.status);

  if (!localPayment) {
    await writeWebhookReceipt({
      fingerprint,
      event,
      providerPaymentId: verifiedPayment.id,
      localPaymentId,
      outcome: "local_payment_not_found",
      metadata: { yookassaStatus: verifiedPayment.status },
    });
    return NextResponse.json({ ok: true });
  }

  const providerPayload = mergeYooKassaPaymentPayload(
    localPayment.providerPayload,
    verifiedPayment,
  );
  const nextStatus = mapYooKassaPaymentStatus(verifiedPayment.status);
  await applyProviderPaymentStatus(db, localPayment.id, nextStatus, {
    providerPaymentId: verifiedPayment.id,
    confirmationUrl: verifiedPayment.confirmation?.confirmation_url ?? localPayment.confirmationUrl,
    providerPayload,
  });
  await writeWebhookReceipt({
    fingerprint,
    event,
    providerPaymentId: verifiedPayment.id,
    localPaymentId: localPayment.id,
    outcome: `payment_${verifiedPayment.status}`,
    metadata: { yookassaStatus: verifiedPayment.status },
  });

  return NextResponse.json({ ok: true });
}

async function processRefundNotification(
  event: string,
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const notificationRefundId = getObjectId(payload);
  if (!notificationRefundId) {
    return NextResponse.json({ ok: false, error: "refund id is missing" }, { status: 400 });
  }

  const refund = await getYooKassaRefund(notificationRefundId);
  const paymentId = getString(refund.payment_id);
  const fingerprint = buildFingerprint(event, refund.id, refund.status ?? null);

  if (!paymentId) {
    await writeWebhookReceipt({
      fingerprint,
      event,
      outcome: "refund_payment_id_missing",
      metadata: { refund: refund as Prisma.InputJsonObject },
    });
    return NextResponse.json({ ok: true });
  }

  const localPayment = await db.payment.findFirst({
    where: {
      provider: PaymentProvider.YOOKASSA,
      providerPaymentId: paymentId,
    },
  });

  if (!localPayment) {
    await writeWebhookReceipt({
      fingerprint,
      event,
      providerPaymentId: paymentId,
      outcome: "refund_local_payment_not_found",
      metadata: { refund: refund as Prisma.InputJsonObject },
    });
    return NextResponse.json({ ok: true });
  }

  await db.payment.update({
    where: { id: localPayment.id },
    data: {
      providerPayload: appendYooKassaRefundPayload(localPayment.providerPayload, refund),
    },
  });
  await writeWebhookReceipt({
    fingerprint,
    event,
    providerPaymentId: paymentId,
    localPaymentId: localPayment.id,
    outcome: "refund_succeeded",
    metadata: { refund: refund as Prisma.InputJsonObject },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!isRecord(payload) || payload.type !== "notification") {
    return NextResponse.json({ ok: false, error: "invalid notification" }, { status: 400 });
  }

  const event = getString(payload.event);
  if (!event || !supportedEvents.has(event)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (event.startsWith("payment.")) {
    return processPaymentNotification(event, payload);
  }

  return processRefundNotification(event, payload);
}
