import { PaymentProvider } from "@prisma/client";
import { isMockPaymentsEnabled } from "@/lib/security-config";

export function ensurePaymentProviderAllowed(provider: PaymentProvider): void {
  if (provider === PaymentProvider.MOCK && !isMockPaymentsEnabled()) {
    throw new Error("MOCK_PAYMENTS_DISABLED");
  }
}
