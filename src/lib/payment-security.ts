import { PaymentProvider } from "@prisma/client";

export function ensurePaymentProviderAllowed(provider: PaymentProvider): void {
  if (provider !== PaymentProvider.MANAGER && provider !== PaymentProvider.YOOKASSA) {
    throw new Error("PAYMENT_PROVIDER_DISABLED");
  }
}
