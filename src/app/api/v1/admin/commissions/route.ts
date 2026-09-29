import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission, requireRole } from "@/lib/auth/authorization";
import { commissionRuleInputSchema } from "@/lib/validation/commission";
import { parseJsonBody } from "@/lib/validation/request";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { CommissionManagementService, parseCommissionTransactionFilters } from "@/services/commission/commission-management-service";
import { errors } from "@/lib/errors/app-error";

export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.COMMISSIONS.VIEW_ALL, request);
  const params = new URL(request.url).searchParams; const view = params.get("view") ?? "overview";
  if (view === "overview") return apiSuccess(await CommissionManagementService.overview());
  if (view === "rules") return apiSuccess({ rules: await CommissionManagementService.rules() });
  if (view === "transactions") return apiSuccess(await CommissionManagementService.transactions(parseCommissionTransactionFilters(params)));
  throw errors.badRequest("Invalid commission view.");
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const context = await requireRole("SUPER_ADMIN", request);
  await requirePermission(PERMISSION.COMMISSIONS.MANAGE_RULES, request);
  const input = await parseJsonBody(request, commissionRuleInputSchema);
  return apiSuccess(await CommissionManagementService.createRule(input, context.user._id, getAuditRequestContext(request)), { status: 201 });
});
