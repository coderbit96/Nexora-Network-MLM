import { hasPermission, type AuthorizationSnapshot } from "@/lib/auth/policy";
import { PERMISSION, type PermissionKey } from "@/config/permissions";
import type { ApplicationRoleName } from "@/types/domain";

type RoleDefinition = { baseRole: ApplicationRoleName; permissions: readonly PermissionKey[]; isSystem?: boolean };

/** Editing an assigned role is an authorization grant just like assigning it. */
export function canManageRoleDefinition(actor: AuthorizationSnapshot, role: RoleDefinition) {
  if (actor.status !== "ACTIVE" || !actor.roles.length) return false;
  if (actor.roles.includes("SUPER_ADMIN")) return true;
  return !role.isSystem && role.baseRole === "STAFF"
    && role.permissions.every((permission) => hasPermission(actor, permission));
}

export function canCreateRoleDefinition(actor: AuthorizationSnapshot, role: RoleDefinition) {
  return hasPermission(actor, PERMISSION.ROLES.CREATE) && canManageRoleDefinition(actor, role);
}
