import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requireAuth, requirePermission } from "@/lib/auth/authorization";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { objectIdSchema, parseJsonBody } from "@/lib/validation/request";
import { updateStaffSchema } from "@/lib/validation/staff";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { StaffService } from "@/services/auth/staff-service";

export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requirePermission(PERMISSION.STAFF.VIEW, request);
  const staffId = objectIdSchema.parse((await params).id);
  const detail = await StaffService.getDetail(staffId, context);
  return apiSuccess({
    ...detail,
    assignableRoles: detail.assignableRoles.map((role) => ({ id: String(role._id), name: role.name, slug: role.slug, baseRole: role.baseRole })),
    capabilities: {
      canEdit: hasPermission(context, PERMISSION.STAFF.EDIT),
      canDisable: hasPermission(context, PERMISSION.STAFF.DISABLE),
      canAssignRoles: hasPermission(context, PERMISSION.ROLES.ASSIGN),
    },
  });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireAuth(request);
  enforceRateLimit(`admin-staff-update:${context.userId}`, 30, 60_000);
  const staffId = objectIdSchema.parse((await params).id);
  const input = await parseJsonBody(request, updateStaffSchema);
  await StaffService.update(staffId, input, context, { actorUserId: context.user._id, ...getAuditRequestContext(request) });
  return apiSuccess({ id: staffId, updated: true });
});
