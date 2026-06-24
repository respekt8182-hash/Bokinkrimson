import { NextResponse } from "next/server";
import { z } from "zod";
import { legalConfig } from "@/config/legal";
import { db } from "@/lib/db";
import { buildConsentEvidence } from "@/lib/legal-consents";
import { logger } from "@/lib/logger";
import { calculatePeriodicPreliminaryRefund } from "@/lib/refunds";
import { getRequestIp } from "@/lib/security";

const refundRequestSchema = z.object({
  orderNumber: z.string().trim().min(1).max(80),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  serviceType: z.string().trim().min(2).max(120),
  paidAmount: z.number().min(0).max(10_000_000),
  paidAt: z.string().trim().optional().default(""),
  reason: z.string().trim().min(2).max(120),
  comment: z.string().trim().max(4000).optional().default(""),
  usedDays: z.number().int().min(0).optional().default(0),
  totalServiceDays: z.number().int().min(1).optional().default(1),
  documentedActualExpenses: z.number().min(0).optional().default(0),
  personalDataConsent: z.boolean().refine((value) => value === true),
});

function buildRequestNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `RF-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = refundRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте корректность данных обращения" }, { status: 400 });
  }

  const data = parsed.data;
  const preliminary = calculatePeriodicPreliminaryRefund({
    paidAmount: data.paidAmount,
    usedDays: data.usedDays,
    totalServiceDays: data.totalServiceDays,
    documentedActualExpenses: data.documentedActualExpenses,
  });

  try {
    const created = await db.refundRequest.create({
      data: {
        requestNumber: buildRequestNumber(),
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || null,
        serviceType: data.serviceType,
        paidAmount: data.paidAmount,
        paidAt: data.paidAt ? new Date(data.paidAt) : null,
        reason: data.reason,
        comment: data.comment || null,
        preliminaryAmount: preliminary.preliminaryRefund,
        documentedExpenses: preliminary.documentedActualExpenses,
        consentEvidence: buildConsentEvidence({
          consentType: "personal_data",
          action: "granted",
          documentVersion: legalConfig.documents.personalDataConsentVersion,
          url: "/refund-request",
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
          categories: ["refund_request"],
        }),
      },
      select: {
        requestNumber: true,
        preliminaryAmount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      requestNumber: created.requestNumber,
      preliminaryAmount: created.preliminaryAmount,
      notice: preliminary.notice,
    });
  } catch (error) {
    logger.error("Refund request creation failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Обращение по возврату временно недоступно. Напишите в поддержку." },
      { status: 503 },
    );
  }
}
