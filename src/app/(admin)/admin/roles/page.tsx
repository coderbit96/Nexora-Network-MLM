import { RoleManager } from "@/components/admin/role-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PERMISSION } from "@/config/permissions";
import { requirePermission } from "@/lib/auth/authorization";
import { hasPermission, hasRole } from "@/lib/auth/policy";

export default async function RolesPage() {
  const context = await requirePermission(PERMISSION.ROLES.VIEW);
  return <><AdminPageHeader eyebrow="Access control" title="Roles" description="Create scoped custom roles and manage permission grants with an auditable history." /><RoleManager actor={{ status: context.status, roles: context.roles, permissions: context.permissions }} canCreate={hasPermission(context, PERMISSION.ROLES.CREATE)} canEdit={hasPermission(context, PERMISSION.ROLES.EDIT)} canDelete={hasPermission(context, PERMISSION.ROLES.DELETE)} canManageSystemStatus={hasRole(context, "SUPER_ADMIN")} /></>;
}
