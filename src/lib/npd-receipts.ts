import { legalConfig } from "@/config/legal";

export type ReceiptStatus =
  | "receipt_pending_manual_issue"
  | "created"
  | "sent"
  | "failed"
  | "refund_pending"
  | "refunded";

export type PlatformServiceOrder = {
  id: string;
  orderNumber: string;
  serviceName: string;
  amount: number;
  payerEmail?: string | null;
  offerVersion: string;
};

export type ReceiptResult = {
  status: ReceiptStatus;
  receiptId?: string;
  receiptUrl?: string;
  manualIssueDeadlineAt?: Date;
  adminNotificationRequired: boolean;
  customerMessage: string;
};

export interface NpdReceiptProvider {
  createReceipt(order: PlatformServiceOrder): Promise<ReceiptResult>;
  createRefundReceipt(order: PlatformServiceOrder, amount: number): Promise<ReceiptResult>;
  getReceiptStatus(receiptId: string): Promise<ReceiptStatus>;
}

function buildManualReceiptResult(): ReceiptResult {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 1);

  return {
    status: "receipt_pending_manual_issue",
    manualIssueDeadlineAt: deadline,
    adminNotificationRequired: true,
    customerMessage:
      "Оплата услуги сайта получена. Чек НПД будет направлен после ручного формирования владельцем сайта.",
  };
}

export class ManualNpdReceiptProvider implements NpdReceiptProvider {
  async createReceipt(): Promise<ReceiptResult> {
    return buildManualReceiptResult();
  }

  async createRefundReceipt(): Promise<ReceiptResult> {
    return {
      ...buildManualReceiptResult(),
      status: "refund_pending",
      customerMessage:
        "Возврат зарегистрирован. Корректирующий чек НПД будет направлен после ручного формирования.",
    };
  }

  async getReceiptStatus(): Promise<ReceiptStatus> {
    return "receipt_pending_manual_issue";
  }
}

export function assertPlatformServicePaymentAllowed(serviceName: string): void {
  if (legalConfig.business.accommodationPaymentsEnabled) {
    throw new Error("Accommodation payments are disabled in lead-directory mode");
  }

  const normalized = serviceName.trim().toLowerCase();
  const allowed = legalConfig.business.paidPlatformServices.some(
    (item) => item.trim().toLowerCase() === normalized,
  );

  if (!allowed) {
    throw new Error("Only explicitly configured platform services can be paid through the site");
  }
}
