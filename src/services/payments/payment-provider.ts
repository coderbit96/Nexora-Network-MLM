import "server-only";

import type { PaymentStatus } from "@/types/domain";

export type ProviderPaymentInput = { paymentId: string; orderId: string; amountMinor: bigint; currency: string; idempotencyKey: string; returnUrl: string };
export type ProviderPaymentResult = { providerTransactionId: string; status: Extract<PaymentStatus, "PENDING" | "SUCCESS" | "FAILED">; clientAction?: { type: "REDIRECT" | "NONE"; url?: string }; raw: Record<string, unknown> };
export type ProviderVerification = { providerTransactionId: string; status: Extract<PaymentStatus, "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED">; raw: Record<string, unknown> };
export type ProviderWebhookEvent = { eventId: string; providerTransactionId: string; status: Extract<PaymentStatus, "SUCCESS" | "FAILED" | "REFUNDED">; raw: Record<string, unknown> };

export interface PaymentProvider {
  readonly id: string;
  readonly developmentOnly?: boolean;
  createPayment(input: ProviderPaymentInput): Promise<ProviderPaymentResult>;
  verifyPayment(input: { providerTransactionId: string }): Promise<ProviderVerification>;
  handleWebhook(input: { rawBody: string; headers: Headers }): Promise<ProviderWebhookEvent>;
  refundPayment?(input: { providerTransactionId: string; amountMinor: bigint; currency: string }): Promise<ProviderVerification>;
}
