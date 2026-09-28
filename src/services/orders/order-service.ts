import "server-only";

import { type Types, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { getServerEnv } from "@/lib/env";
import { errors } from "@/lib/errors/app-error";
import { AuditLog, Cart, Category, MemberProfile, Notification, Order, Payment, Product, SystemCounter } from "@/models";
import { buildAuthoritativeOrderSnapshot } from "@/services/orders/order-calculator";
import { canTransitionOrder } from "@/services/orders/order-transitions";
import { notifyAdministrators } from "@/services/notifications/notification-service";
import { SystemSettingsService } from "@/services/settings/system-settings-service";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";
import type { IOrder, OrderStatus } from "@/types/domain";

function duplicate(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000; }

export class OrderService {
  static async checkout(memberProfileId: Types.ObjectId, idempotencyKey: string) {
    await connectToDatabase(); const session = await startSession(); let result: { orderId: string; orderNumber: string; created: boolean } | undefined;
    try {
      await session.withTransaction(async () => {
        const existing = await Order.findOne({ memberProfileId, checkoutIdempotencyKey: idempotencyKey }).session(session).lean();
        if (existing) { result = { orderId: String(existing._id), orderNumber: existing.orderNumber, created: false }; return; }
        const [profile, cart] = await Promise.all([MemberProfile.findById(memberProfileId).select("userId activationStatus").session(session).lean(), Cart.findOne({ memberProfileId }).session(session).lean()]);
        if (!profile || profile.activationStatus !== "ACTIVE") throw errors.forbidden("Only active members can checkout.");
        if (!cart?.items.length) throw errors.badRequest("Your cart is empty.");
        const productIds = cart.items.map((item) => item.productId);
        const products = await Product.find({ _id: { $in: productIds } }).session(session).lean();
        const categories = await Category.find({ _id: { $in: products.map((product) => product.categoryId) }, status: "ACTIVE" }).select("_id").session(session).lean();
        const activeCategoryIds = new Set(categories.map((category) => String(category._id))); let snapshot: ReturnType<typeof buildAuthoritativeOrderSnapshot>;
        try { snapshot = buildAuthoritativeOrderSnapshot(cart.items, products, activeCategoryIds); } catch (error) { throw errors.badRequest(error instanceof Error ? error.message : "Invalid cart."); }
        const { items, currency, subtotalMinor } = snapshot;
        const configuration = await SystemSettingsService.read(session);
        if (currency !== configuration.settings.currency) throw errors.conflict("Product currency does not match the configured base currency.");
        for (const item of items) { const decremented = await Product.updateOne({ _id: item.productId, status: "ACTIVE", stockQuantity: { $gte: item.quantity } }, { $inc: { stockQuantity: -item.quantity } }, { session }); if (decremented.modifiedCount !== 1) throw errors.conflict(`${item.name} no longer has sufficient stock.`); }
        const counter = await SystemCounter.findByIdAndUpdate("order-number", { $inc: { sequence: 1 } }, { new: true, upsert: true, session, setDefaultsOnInsert: true }); if (!counter) throw new Error("Could not allocate an order number.");
        const order = await Order.create([{ orderNumber: `${configuration.settings.commerce.orderNumberPrefix}${String(counter.sequence).padStart(8, "0")}`, memberProfileId, currency, items, subtotalMinor, discountMinor: 0n, taxMinor: 0n, totalMinor: subtotalMinor, status: "PAYMENT_PENDING", paymentStatus: "CREATED", commissionStatus: "NOT_ELIGIBLE", checkoutIdempotencyKey: idempotencyKey }], { session });
        await Payment.create([{ orderId: order[0]._id, provider: getServerEnv().PAYMENT_PROVIDER, amountMinor: subtotalMinor, currency, status: "CREATED", idempotencyKey: `payment:${String(order[0]._id)}` }], { session });
        await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });
        await Notification.create([{ userId: profile.userId, type: "ORDER", title: "Order created", body: `Order ${order[0].orderNumber} is awaiting payment confirmation.`, actionUrl: `/member/orders/${String(order[0]._id)}`, metadata: { orderId: String(order[0]._id), orderNumber: order[0].orderNumber } }], { session });
        await notifyAdministrators({ type: "ORDER", title: "New order created", body: `Order ${order[0].orderNumber} is awaiting payment confirmation.`, actionUrl: "/admin/orders", metadata: { orderId: String(order[0]._id) }, session });
        await AuditLog.create([{ actorUserId: profile.userId, action: "order.created", resourceType: "Order", resourceId: String(order[0]._id), metadata: { orderNumber: order[0].orderNumber, totalMinor: subtotalMinor.toString(), itemCount: items.length } }], { session });
        result = { orderId: String(order[0]._id), orderNumber: order[0].orderNumber, created: true };
      });
      if (!result) throw new Error("Checkout did not complete."); return result;
    } catch (error) {
      if (!duplicate(error)) throw error;
      const existing = await Order.findOne({ memberProfileId, checkoutIdempotencyKey: idempotencyKey }).lean(); if (!existing) throw error; return { orderId: String(existing._id), orderNumber: existing.orderNumber, created: false };
    } finally { await session.endSession(); }
  }

  static async updateFulfillmentStatus(orderId: string, targetStatus: Extract<OrderStatus, "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED">, actorUserId: Types.ObjectId, note?: string, audit?: AuditRequestContext): Promise<IOrder & { _id: Types.ObjectId }> {
    await connectToDatabase(); const session = await startSession(); let result: (IOrder & { _id: Types.ObjectId }) | null = null;
    try { await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session); if (!order) throw errors.notFound("Order was not found.");
      if (!canTransitionOrder(order.status, targetStatus)) throw errors.conflict(`Invalid order transition: ${order.status} to ${targetStatus}.`);
      const before = order.status;
      if (targetStatus === "CANCELLED") {
        for (const item of order.items) await Product.updateOne({ _id: item.productId }, { $inc: { stockQuantity: item.quantity } }, { session });
        await Payment.updateMany({ orderId: order._id, status: { $in: ["CREATED", "PENDING"] } }, { $set: { status: "FAILED" } }, { session });
        order.paymentStatus = "FAILED";
      }
      order.status = targetStatus; await order.save({ session });
      await AuditService.record({ actorUserId, action: "order.status_changed", resourceType: "Order", resourceId: orderId, ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), before: { status: before }, after: { status: targetStatus, paymentStatus: order.paymentStatus }, ...(note ? { metadata: { note } } : {}) }, session); result = order.toObject() as IOrder & { _id: Types.ObjectId };
    }); } finally { await session.endSession(); }
    if (!result) throw new Error("Order status update did not complete."); return result;
  }
}
