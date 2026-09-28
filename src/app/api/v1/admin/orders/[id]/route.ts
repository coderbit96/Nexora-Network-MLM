import { Types } from "mongoose";

import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { orderStatusSchema } from "@/lib/validation/orders";
import { parseJsonBody } from "@/lib/validation/request";
import { Order, Payment } from "@/models";
import { OrderService } from "@/services/orders/order-service";
import { serializeOrder } from "@/services/orders/order-query";
import { PaymentService } from "@/services/payments/payment-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const id = (await params).id; if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid order identifier."); const body = await parseJsonBody(request, orderStatusSchema); const requiredPermission = body.status === "REFUNDED" ? PERMISSION.ORDERS.REFUND : body.status === "CANCELLED" ? PERMISSION.ORDERS.CANCEL : PERMISSION.ORDERS.MANAGE; const context = await requirePermission(requiredPermission, request); const audit = getAuditRequestContext(request); if (body.status === "REFUNDED") { const payment = await Payment.findOne({ orderId: id }).select("_id").lean(); if (!payment) throw errors.notFound("Payment was not found."); await PaymentService.refundPayment(String(payment._id), context.user._id); const order = await Order.findById(id).lean(); if (!order) throw errors.notFound("Order was not found."); return apiSuccess(serializeOrder(order)); } return apiSuccess(serializeOrder(await OrderService.updateFulfillmentStatus(id, body.status, context.user._id, body.note, audit))); });
