import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoleManager } from "@/components/admin/role-manager";
import { PERMISSION } from "@/config/permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";
import { hasPermission, hasRole } from "@/lib/auth/policy";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireAdminPagePermission(PERMISSION.ROLES.VIEW, "/admin/roles");
  const { id } = await params;
  return <><AdminPageHeader eyebrow="Access control" title="Role details" description="Review the role's grants, status, and assigned-user count. System-role identity is protected." /><RoleManager initialRoleId={id} actor={{ status: context.status, roles: context.roles, permissions: context.permissions }} canCreate={hasPermission(context, PERMISSION.ROLES.CREATE)} canEdit={hasPermission(context, PERMISSION.ROLES.EDIT)} canDelete={hasPermission(context, PERMISSION.ROLES.DELETE)} canManageSystemStatus={hasRole(context, "SUPER_ADMIN")} /></>;
}
