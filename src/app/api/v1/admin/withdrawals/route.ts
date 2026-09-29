import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { PERMISSION } from "@/config/permissions";
import { allowedAdministrativeWithdrawalTransitions } from "@/services/withdrawal/withdrawal-authorization";
import { getAdminWithdrawalPage } from "@/services/withdrawal/admin-withdrawal-query";
import { parseWithdrawalFilters } from "@/services/withdrawal/withdrawal-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.WITHDRAWALS.VIEW_ALL, request);
  const page = await getAdminWithdrawalPage(parseWithdrawalFilters(new URL(request.url).searchParams));
  return apiSuccess({
    canExport: hasPermission(context, PERMISSION.WITHDRAWALS.EXPORT),
    withdrawals: page.withdrawals.map((withdrawal) => ({ ...withdrawal, allowedTransitions: allowedAdministrativeWithdrawalTransitions(context, withdrawal.status) })),
    pagination: page.pagination,
    statusCounts: page.statusCounts,
  });
});
