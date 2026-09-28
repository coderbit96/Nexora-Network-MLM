import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { errors } from "@/lib/errors/app-error";
import { getServerEnv } from "@/lib/env";
import type { PaymentProvider, ProviderPaymentInput, ProviderPaymentResult, ProviderVerification, ProviderWebhookEvent } from "@/services/payments/payment-provider";

function signature(value: string) { return createHmac("sha256", getServerEnv().PAYMENT_WEBHOOK_SECRET).update(value).digest("hex"); }

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";
  readonly developmentOnly = true;

  async createPayment(input: ProviderPaymentInput): Promise<ProviderPaymentResult> { return { providerTransactionId: `mock_${input.paymentId}`, status: "PENDING", clientAction: { type: "NONE" }, raw: { mode: "development_mock", orderId: input.orderId } }; }
  async verifyPayment(input: { providerTransactionId: string }): Promise<ProviderVerification> { return { providerTransactionId: input.providerTransactionId, status: "PENDING", raw: { mode: "development_mock" } }; }
  async refundPayment(input: { providerTransactionId: string }): Promise<ProviderVerification> { return { providerTransactionId: input.providerTransactionId, status: "REFUNDED", raw: { mode: "development_mock" } }; }
  async handleWebhook(input: { rawBody: string; headers: Headers }): Promise<ProviderWebhookEvent> {
    const supplied = input.headers.get("x-mock-signature"); const expected = signature(input.rawBody);
    if (!supplied || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw errors.unauthorized("Invalid mock payment webhook signature.");
    let payload: unknown; try { payload = JSON.parse(input.rawBody); } catch { throw errors.badRequest("Invalid mock webhook payload."); }
    if (!payload || typeof payload !== "object") throw errors.badRequest("Invalid mock webhook payload."); const event = payload as { eventId?: unknown; providerTransactionId?: unknown; status?: unknown };
    if (typeof event.eventId !== "string" || typeof event.providerTransactionId !== "string" || !["SUCCESS", "FAILED", "REFUNDED"].includes(String(event.status))) throw errors.badRequest("Invalid mock webhook event.");
    return { eventId: event.eventId, providerTransactionId: event.providerTransactionId, status: event.status as ProviderWebhookEvent["status"], raw: payload as Record<string, unknown> };
  }
}
