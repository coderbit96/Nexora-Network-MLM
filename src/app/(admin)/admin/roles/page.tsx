import { RoleManager } from "@/components/admin/role-manager";
import { PERMISSION } from "@/config/permissions";
import { requirePermission } from "@/lib/auth/authorization";
import { hasPermission, hasRole } from "@/lib/auth/policy";

export default async function RolesPage() {
  const context = await requirePermission(PERMISSION.ROLES.VIEW);
  return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Access control</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Roles</h1><p className="mt-2 text-muted-foreground">Create scoped custom roles and manage permission grants with an auditable history.</p></div><RoleManager actor={{ status: context.status, roles: context.roles, permissions: context.permissions }} canCreate={hasPermission(context, PERMISSION.ROLES.CREATE)} canEdit={hasPermission(context, PERMISSION.ROLES.EDIT)} canDelete={hasPermission(context, PERMISSION.ROLES.DELETE)} canManageSystemStatus={hasRole(context, "SUPER_ADMIN")} /></>;
}
