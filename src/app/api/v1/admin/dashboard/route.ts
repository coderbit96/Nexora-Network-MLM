import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { PERMISSION } from "@/config/permissions";
import { getAdminDashboard, parseAdminDashboardRange } from "@/services/dashboard/admin-dashboard";

export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.DASHBOARD.VIEW, request);
  const range = parseAdminDashboardRange(new URL(request.url).searchParams);
  return apiSuccess(await getAdminDashboard(range));
});
