import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { RoleService } from "@/services/auth/role-service";
import { createRoleSchema } from "@/lib/validation/roles";
import { parseJsonBody } from "@/lib/validation/request";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { getRoleManagementPage, parseRoleListFilters } from "@/services/auth/role-management-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.ROLES.VIEW, request);
  return apiSuccess(await getRoleManagementPage(parseRoleListFilters(new URL(request.url).searchParams)));
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.ROLES.CREATE, request);
  enforceRateLimit(`admin-role-create:${context.userId}`, 20, 60_000);
  const input = await parseJsonBody(request, createRoleSchema);
  const role = await RoleService.create(input, { actorUserId: context.user._id, actor: context, ...getAuditRequestContext(request) });
  return apiSuccess(role, { status: 201 });
});
