import "server-only";

import { errors } from "@/lib/errors/app-error";
import { getServerEnv } from "@/lib/env";
import { MockPaymentProvider } from "@/services/payments/mock-payment-provider";
import type { PaymentProvider } from "@/services/payments/payment-provider";

export function getPaymentProvider(providerName = getServerEnv().PAYMENT_PROVIDER): PaymentProvider {
  if (providerName === "mock") {
    if (process.env.NODE_ENV === "production" || !getServerEnv().PAYMENT_MOCK_ENABLED) throw errors.forbidden("The mock payment provider is disabled.");
    return new MockPaymentProvider();
  }
  throw errors.badRequest(`Payment provider '${providerName}' is not configured.`);
}
