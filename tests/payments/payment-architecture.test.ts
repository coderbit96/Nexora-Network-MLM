import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { Payment, PaymentWebhookEvent } from "@/models";
import type { PaymentProvider } from "@/services/payments/payment-provider";
import { canTransitionPayment } from "@/services/payments/payment-service";

test("payment records accept only normalized provider-neutral statuses", async () => {
  const payment = new Payment({ orderId: new Types.ObjectId(), provider: "mock", amountMinor: 12_345n, currency: "INR", status: "CAPTURED", idempotencyKey: "payment:test" });
  await assert.rejects(payment.validate(), /`CAPTURED` is not a valid enum value/i);
});

test("payment and webhook event indexes provide settlement idempotency", () => {
  const paymentIndexes = Payment.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  const webhookIndexes = PaymentWebhookEvent.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  assert.equal(paymentIndexes.some(([keys, options]) => "provider" in keys && "providerTransactionId" in keys && options.unique === true), true);
  assert.equal(webhookIndexes.some(([keys, options]) => "provider" in keys && "eventId" in keys && options.unique === true), true);
});

test("provider adapters distinguish initiation from authoritative settlement", async () => {
  const provider: PaymentProvider = {
    id: "test-provider",
    developmentOnly: true,
    createPayment: async () => ({ providerTransactionId: "test-transaction", status: "PENDING", clientAction: { type: "NONE" }, raw: {} }),
    verifyPayment: async () => ({ providerTransactionId: "test-transaction", status: "PENDING", raw: {} }),
    handleWebhook: async () => ({ eventId: "test-event", providerTransactionId: "test-transaction", status: "SUCCESS", raw: {} }),
  };
  const started = await provider.createPayment({ paymentId: "payment-1", orderId: "order-1", amountMinor: 12_345n, currency: "INR", idempotencyKey: "payment:order-1", returnUrl: "http://localhost:3000/member/orders/order-1" });
  assert.equal(provider.developmentOnly, true);
  assert.equal(started.status, "PENDING");
  assert.equal(started.clientAction?.type, "NONE");
});

test("payment settlement rejects out-of-order terminal-state replays", () => {
  assert.equal(canTransitionPayment("CREATED", "PENDING"), true);
  assert.equal(canTransitionPayment("PENDING", "SUCCESS"), true);
  assert.equal(canTransitionPayment("SUCCESS", "REFUNDED"), true);
  assert.equal(canTransitionPayment("REFUNDED", "SUCCESS"), false);
  assert.equal(canTransitionPayment("SUCCESS", "PENDING"), false);
  assert.equal(canTransitionPayment("FAILED", "SUCCESS"), false);
});
