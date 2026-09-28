import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { RoleService } from "@/services/auth/role-service";
import { updateRoleSchema } from "@/lib/validation/roles";
import { objectIdSchema, parseJsonBody } from "@/lib/validation/request";

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requirePermission(PERMISSION.ROLES.EDIT, request);
  enforceRateLimit(`admin-role-update:${context.userId}`, 30, 60_000);
  const id = objectIdSchema.parse((await params).id);
  const input = await parseJsonBody(request, updateRoleSchema);
  if (!Object.keys(input).length) throw errors.badRequest("Provide at least one role field to update.");
  await RoleService.update(id, input, { actorUserId: context.user._id, ...getAuditRequestContext(request) });
  return apiSuccess({ id, updated: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requirePermission(PERMISSION.ROLES.DELETE, request);
  enforceRateLimit(`admin-role-delete:${context.userId}`, 10, 60_000);
  const id = objectIdSchema.parse((await params).id);
  await RoleService.remove(id, { actorUserId: context.user._id, ...getAuditRequestContext(request) });
  return apiSuccess({ id, deleted: true });
});
