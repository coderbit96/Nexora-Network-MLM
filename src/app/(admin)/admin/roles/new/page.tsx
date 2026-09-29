import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoleManager } from "@/components/admin/role-manager";
import { PERMISSION } from "@/config/permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";
import { hasPermission, hasRole } from "@/lib/auth/policy";

export default async function NewRolePage() {
  const context = await requireAdminPagePermission(PERMISSION.ROLES.CREATE, "/admin/roles/new");
  return <><AdminPageHeader eyebrow="Access control" title="Create role" description="Create a custom role with the minimum permissions needed for its operational responsibility." /><RoleManager initialCreate actor={{ status: context.status, roles: context.roles, permissions: context.permissions }} canCreate={hasPermission(context, PERMISSION.ROLES.CREATE)} canEdit={hasPermission(context, PERMISSION.ROLES.EDIT)} canDelete={hasPermission(context, PERMISSION.ROLES.DELETE)} canManageSystemStatus={hasRole(context, "SUPER_ADMIN")} /></>;
}
