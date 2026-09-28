import { Types } from "mongoose";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { Order, Payment } from "@/models";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { PaymentService } from "@/services/payments/payment-service";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";

async function access(request: Request, params: Promise<{ id: string }>) { const context = await requireRole("MEMBER", request); const orderId = (await params).id; if (!Types.ObjectId.isValid(orderId)) throw errors.badRequest("Invalid order identifier."); const profile = await getMemberProfileByUserId(context.user._id); return { context, profile, orderId }; }
export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const { profile, orderId } = await access(request, params); const payment = await Payment.findOne({ orderId }).lean(); if (!payment) throw errors.notFound("Payment was not found."); const orderOwner = await Order.exists({ _id: orderId, memberProfileId: profile._id }); if (!orderOwner) throw errors.notFound("Payment was not found."); return apiSuccess({ id: String(payment._id), provider: payment.provider, status: payment.status, ...(payment.providerTransactionId ? { providerTransactionId: payment.providerTransactionId } : {}), developmentMock: payment.provider === "mock" && process.env.NODE_ENV !== "production" }); });
export const POST = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const { context, profile, orderId } = await access(request, params); enforceRateLimit(`payment-create:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 10, 60_000); return apiSuccess(await PaymentService.createPayment(profile._id, orderId)); });
