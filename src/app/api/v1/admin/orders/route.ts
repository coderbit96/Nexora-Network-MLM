import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { getAdminOrderPage, parseAdminOrderFilters } from "@/services/orders/admin-order-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.ORDERS.VIEW_ALL, request);
  return apiSuccess(await getAdminOrderPage(parseAdminOrderFilters(new URL(request.url).searchParams)));
});
