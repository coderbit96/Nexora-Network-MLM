import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { checkoutSchema } from "@/lib/validation/orders";
import { parseJsonBody } from "@/lib/validation/request";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { OrderService } from "@/services/orders/order-service";

export const POST = withApiErrorHandling(async (request: Request) => { const context = await requireRole("MEMBER", request); enforceRateLimit(`checkout:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 10, 60_000); const profile = await getMemberProfileByUserId(context.user._id); const body = await parseJsonBody(request, checkoutSchema); const order = await OrderService.checkout(profile._id, body.idempotencyKey); return apiSuccess(order, { status: order.created ? 201 : 200 }); });
