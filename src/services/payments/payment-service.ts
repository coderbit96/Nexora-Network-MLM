import "server-only";

import { createHash } from "crypto";
import { type Types, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { AuditLog, CommissionTransaction, Order, Payment, PaymentWebhookEvent } from "@/models";
import { CommissionService } from "@/services/commission/commission-service";
import { canTransitionOrder } from "@/services/orders/order-transitions";
import { getPaymentProvider } from "@/services/payments/payment-provider-registry";
import type { ProviderVerification } from "@/services/payments/payment-provider";
import type { PaymentStatus } from "@/types/domain";

function duplicate(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000; }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Payment provider events may be retried or delivered out of order. Terminal states never reopen. */
export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  const transitions: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
    CREATED: ["PENDING"],
    PENDING: ["SUCCESS", "FAILED"],
    SUCCESS: ["REFUNDED"],
    FAILED: [],
    REFUNDED: [],
  };
  return from === to || transitions[from].includes(to);
}

export class PaymentService {
  static async createPayment(memberProfileId: Types.ObjectId, orderId: string) {
    await connectToDatabase(); const payment = await Payment.findOne({ orderId }).lean(); const order = await Order.findOne({ _id: orderId, memberProfileId }).lean();
    if (!order || !payment) throw errors.notFound("Payment was not found.");
    if (order.status !== "PAYMENT_PENDING") throw errors.conflict("This order is not awaiting payment.");
    if (payment.status === "SUCCESS") return { paymentId: String(payment._id), status: payment.status, provider: payment.provider, developmentMock: payment.provider === "mock" };
    if (payment.status === "PENDING" && payment.providerTransactionId) return { paymentId: String(payment._id), status: payment.status, provider: payment.provider, providerTransactionId: payment.providerTransactionId, developmentMock: payment.provider === "mock" };
    if (payment.status === "FAILED" && payment.providerTransactionId) throw errors.conflict("This payment attempt has failed and cannot be restarted.");

    // Claim the attempt *before* calling an external provider. Without this conditional update,
    // simultaneous requests can create multiple charge/intents for one order.
    const claimed = await Payment.findOneAndUpdate({
      _id: payment._id,
      providerTransactionId: { $exists: false },
      status: { $in: ["CREATED", "FAILED"] },
    }, { $set: { status: "PENDING" } }, { returnDocument: "after", runValidators: true }).lean();
    if (!claimed) throw errors.conflict("Payment initialization is already in progress. Please try again shortly.");

    const provider = getPaymentProvider(claimed.provider);
    try {
      const result = await provider.createPayment({ paymentId: String(claimed._id), orderId, amountMinor: claimed.amountMinor, currency: claimed.currency, idempotencyKey: claimed.idempotencyKey, returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/member/orders/${orderId}` });
      // Initiation is not settlement. Authoritative verification/webhook processing alone may
      // move the payment to SUCCESS, even if a provider returns an optimistic status here.
      const persisted = await Payment.updateOne({ _id: claimed._id, status: "PENDING", providerTransactionId: { $exists: false } }, { $set: { providerTransactionId: result.providerTransactionId, providerPayload: result.raw } }, { runValidators: true });
      if (persisted.modifiedCount !== 1) throw errors.conflict("Payment initialization could not be finalized safely.");
      await Order.updateOne({ _id: order._id, paymentStatus: "CREATED" }, { $set: { paymentStatus: "PENDING" } });
      return { paymentId: String(claimed._id), status: "PENDING" as const, provider: claimed.provider, providerTransactionId: result.providerTransactionId, clientAction: result.clientAction, developmentMock: provider.developmentOnly === true };
    } catch (error) {
      // Only release our own uninitialized claim. A concurrently settled payment must never be
      // overwritten by an initiation failure.
      await Payment.updateOne({ _id: claimed._id, status: "PENDING", providerTransactionId: { $exists: false } }, { $set: { status: "FAILED" } });
      throw error;
    }
  }

  private static async settle(paymentId: string, result: ProviderVerification, event?: { provider: string; eventId: string; rawBody: string }, actorUserId?: Types.ObjectId) {
    await connectToDatabase(); const session = await startSession(); let sourceOrderId: string | undefined; let processed = false;
    try { await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session); if (!payment) throw errors.notFound("Payment was not found.");
      sourceOrderId = String(payment.orderId);
      if (payment.providerTransactionId && payment.providerTransactionId !== result.providerTransactionId) throw errors.conflict("Provider payment reference does not match.");
      if (event) {
        try { await PaymentWebhookEvent.create([{ provider: event.provider, eventId: event.eventId, paymentId: payment._id, status: "RECEIVED", payloadHash: hash(event.rawBody) }], { session }); }
        catch (error) { if (duplicate(error)) return; throw error; }
      }
      if (payment.status === result.status) { if (event) await PaymentWebhookEvent.updateOne({ provider: event.provider, eventId: event.eventId }, { $set: { status: "PROCESSED", processedAt: new Date() } }, { session }); return; }
      if (!canTransitionPayment(payment.status, result.status)) throw errors.conflict(`Invalid payment transition: ${payment.status} to ${result.status}.`);
      const order = await Order.findById(payment.orderId).session(session); if (!order) throw errors.notFound("Payment order was not found.");
      payment.providerTransactionId = result.providerTransactionId; payment.status = result.status; payment.providerPayload = result.raw; await payment.save({ session });
      if (result.status === "SUCCESS") {
        if (order.paymentStatus !== "SUCCESS") { order.paymentStatus = "SUCCESS"; order.status = "PAID"; order.paidAt = new Date(); order.commissionStatus = "PENDING"; await order.save({ session }); }
      } else if (result.status === "FAILED") { order.paymentStatus = "FAILED"; await order.save({ session }); }
      else if (result.status === "REFUNDED") { if (!canTransitionOrder(order.status, "REFUNDED")) throw errors.conflict(`Order ${order.orderNumber} cannot be refunded in its current state.`); order.paymentStatus = "REFUNDED"; order.status = "REFUNDED"; await order.save({ session }); }
      if (event) await PaymentWebhookEvent.updateOne({ provider: event.provider, eventId: event.eventId }, { $set: { status: "PROCESSED", processedAt: new Date() } }, { session });
      await AuditLog.create([{ ...(actorUserId ? { actorUserId } : {}), action: result.status === "REFUNDED" ? "payment.refunded" : "payment.verified", resourceType: "Payment", resourceId: String(payment._id), metadata: { orderId: String(order._id), provider: payment.provider, status: result.status, ...(event ? { eventId: event.eventId } : {}) } }], { session }); processed = true;
    }); } finally { await session.endSession(); }
    // Reconcile after every successful settlement attempt, including a duplicate webhook. If a
    // previous commission run failed after payment commit, a provider retry can safely recover it.
    if (result.status === "SUCCESS" && sourceOrderId) {
      const orderAwaitingCommission = await Order.exists({ _id: sourceOrderId, paymentStatus: "SUCCESS", commissionStatus: "PENDING" });
      if (orderAwaitingCommission) await CommissionService.processEligibleOrder(sourceOrderId);
    }
    return { processed, paymentId, status: result.status };
  }

  static async verifyPayment(paymentId: string) {
    await connectToDatabase();
    const payment = await Payment.findById(paymentId).lean(); if (!payment?.providerTransactionId) throw errors.badRequest("Payment has not been initialized."); const provider = getPaymentProvider(payment.provider); return PaymentService.settle(String(payment._id), await provider.verifyPayment({ providerTransactionId: payment.providerTransactionId }));
  }

  static async handleWebhook(providerName: string, rawBody: string, headers: Headers) {
    await connectToDatabase();
    const provider = getPaymentProvider(providerName); const event = await provider.handleWebhook({ rawBody, headers }); const payment = await Payment.findOne({ provider: provider.id, providerTransactionId: event.providerTransactionId }).lean(); if (!payment) throw errors.notFound("Webhook payment was not found."); return PaymentService.settle(String(payment._id), { providerTransactionId: event.providerTransactionId, status: event.status, raw: event.raw }, { provider: provider.id, eventId: event.eventId, rawBody });
  }

  /** Explicit development simulation. It is blocked in production and never represents a real payment. */
  static async simulateMockSuccess(memberProfileId: Types.ObjectId, paymentId: string) {
    if (process.env.NODE_ENV === "production") throw errors.forbidden("Mock payment simulation is unavailable in production.");
    await connectToDatabase();
    const payment = await Payment.findById(paymentId).lean(); const order = payment ? await Order.findOne({ _id: payment.orderId, memberProfileId }).lean() : null;
    if (!payment || !order || payment.provider !== "mock" || !payment.providerTransactionId) throw errors.notFound("Mock payment was not found.");
    return PaymentService.settle(String(payment._id), { providerTransactionId: payment.providerTransactionId, status: "SUCCESS", raw: { mode: "development_mock", simulatedAt: new Date().toISOString() } });
  }

  static async refundPayment(paymentId: string, actorUserId: Types.ObjectId) {
    await connectToDatabase();
    const payment = await Payment.findById(paymentId).lean(); if (!payment?.providerTransactionId) throw errors.badRequest("Payment cannot be refunded before it is initialized."); const order = await Order.findById(payment.orderId).select("status").lean(); if (!order || !canTransitionOrder(order.status, "REFUNDED")) throw errors.conflict("This order cannot be refunded in its current state.");
    // A provider refund must not leave already-paid commissions spendable. There is no external
    // transaction spanning a payment gateway and MongoDB, so refuse this irreversible action
    // until an operator runs an explicit, ledger-backed commission-reversal workflow.
    if (await CommissionTransaction.exists({ sourceOrderId: payment.orderId, status: "APPROVED" })) {
      throw errors.conflict("This order has paid commissions and requires a compensating commission reversal before it can be refunded.");
    }
    const provider = getPaymentProvider(payment.provider); if (!provider.refundPayment) throw errors.badRequest("This payment provider does not support refunds."); return PaymentService.settle(String(payment._id), await provider.refundPayment({ providerTransactionId: payment.providerTransactionId, amountMinor: payment.amountMinor, currency: payment.currency }), undefined, actorUserId);
  }
}
