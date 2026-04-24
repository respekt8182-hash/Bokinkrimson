import { createHash, randomBytes } from "crypto";
import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";
import { getEmailDeliveryMode, isProductionEnvironment } from "@/lib/security-config";

type SecurityEmailInput = {
  to: string;
  subject: string;
  text: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return cachedTransporter;
}

export function createSecurityToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecurityToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendSecurityEmail(input: SecurityEmailInput): Promise<void> {
  const deliveryMode = getEmailDeliveryMode();

  if (deliveryMode === "log") {
    logger.info("Security email delivery is running in log mode", {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  const from = process.env.SECURITY_EMAIL_FROM?.trim();
  if (!from) {
    throw new Error("SECURITY_EMAIL_NOT_CONFIGURED");
  }

  try {
    await getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    if (isProductionEnvironment()) {
      throw error;
    }

    logger.warn("Failed to send security email, falling back to log mode", {
      to: input.to,
      subject: input.subject,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
