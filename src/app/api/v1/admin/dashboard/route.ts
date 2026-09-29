import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSION } from "@/config/permissions";
import { getAdminDashboard, parseAdminDashboardRange } from "@/services/dashboard/admin-dashboard";
import { scopeDashboard } from "@/services/dashboard/dashboard-access";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.DASHBOARD.VIEW, request);
  const range = parseAdminDashboardRange(new URL(request.url).searchParams);
  return apiSuccess(scopeDashboard(await getAdminDashboard(range), context));
});
