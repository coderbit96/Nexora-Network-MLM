import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { memberOrders, parseOrderFilters, serializeOrder } from "@/services/orders/order-query";

export const GET = withApiErrorHandling(async (request: Request) => { const context = await requireRole("MEMBER", request); const profile = await getMemberProfileByUserId(context.user._id); const page = await memberOrders(profile._id, parseOrderFilters(new URL(request.url).searchParams)); return apiSuccess({ orders: page.orders.map(serializeOrder), pagination: { total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages } }); });
