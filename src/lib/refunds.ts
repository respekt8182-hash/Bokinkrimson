export type PeriodicRefundInput = {
  paidAmount: number;
  usedDays: number;
  totalServiceDays: number;
  documentedActualExpenses?: number;
};

export type PreliminaryRefundResult = {
  providedValue: number;
  documentedActualExpenses: number;
  preliminaryRefund: number;
  notice: string;
};

export const preliminaryRefundNotice =
  "Предварительная сумма рассчитывается автоматически. Окончательная сумма определяется после проверки фактически оказанной части услуги и документально подтвержденных расходов.";

function money(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function calculatePeriodicPreliminaryRefund(
  input: PeriodicRefundInput,
): PreliminaryRefundResult {
  if (input.paidAmount < 0) {
    throw new Error("paidAmount must be non-negative");
  }

  if (input.totalServiceDays <= 0) {
    throw new Error("totalServiceDays must be positive");
  }

  const usedDays = Math.min(Math.max(0, input.usedDays), input.totalServiceDays);
  const documentedActualExpenses = money(input.documentedActualExpenses ?? 0);
  const providedValue = money((input.paidAmount * usedDays) / input.totalServiceDays);
  const preliminaryRefund = money(input.paidAmount - providedValue - documentedActualExpenses);

  return {
    providedValue,
    documentedActualExpenses,
    preliminaryRefund,
    notice: preliminaryRefundNotice,
  };
}
