import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission, requireRole } from "@/lib/auth/authorization";
import { commissionRuleInputSchema } from "@/lib/validation/commission";
import { parseJsonBody } from "@/lib/validation/request";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { CommissionManagementService } from "@/services/commission/commission-management-service";

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireRole("SUPER_ADMIN", request);
  await requirePermission(PERMISSION.COMMISSIONS.MANAGE_RULES, request);
  await CommissionManagementService.updateRule((await params).id, await parseJsonBody(request, commissionRuleInputSchema), context.user._id, getAuditRequestContext(request));
  return apiSuccess({ updated: true });
});
