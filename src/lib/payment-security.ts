import { PaymentProvider } from "@prisma/client";

export function ensurePaymentProviderAllowed(provider: PaymentProvider): void {
  if (provider !== PaymentProvider.MANAGER) {
    throw new Error("PAYMENT_PROVIDER_DISABLED");
  }
}
