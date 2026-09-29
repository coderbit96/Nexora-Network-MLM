import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requireAnyPermission } from "@/lib/auth/authorization";
import { StaffService } from "@/services/auth/staff-service";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAnyPermission([PERMISSION.STAFF.CREATE, PERMISSION.STAFF.EDIT], request);
  const roles = await StaffService.listAssignableRoles(context, { includeMembers: false });
  return apiSuccess({
    roles: roles.map((role) => ({ id: String(role._id), name: role.name, slug: role.slug, baseRole: role.baseRole })),
    capabilities: {
      canCreate: hasPermission(context, PERMISSION.STAFF.CREATE),
      canEdit: hasPermission(context, PERMISSION.STAFF.EDIT),
      canDisable: hasPermission(context, PERMISSION.STAFF.DISABLE),
      canAssignRoles: hasPermission(context, PERMISSION.ROLES.ASSIGN),
    },
  });
});
