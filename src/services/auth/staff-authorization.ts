import type { AuthorizationSnapshot } from "@/lib/auth/policy";
import { hasPermission } from "@/lib/auth/policy";
import { PERMISSION } from "@/config/permissions";
import type { Types } from "mongoose";
import type { AccountStatus, IRole } from "@/types/domain";

export type AssignableStaffRole = Pick<IRole, "name" | "slug" | "baseRole" | "permissions" | "isActive"> & { _id: Types.ObjectId };

function isExplicitSuperAdmin(actor: AuthorizationSnapshot) {
  // `hasRole` intentionally lets Super Admin pass broad role checks. For role
  // hierarchy, inspect the resolved role itself so an ADMIN never inherits a
  // Super Admin-only staff-management capability.
  return actor.roles.includes("SUPER_ADMIN");
}

export function canAssignStaffRole(actor: AuthorizationSnapshot, role: AssignableStaffRole) {
  if (!role.isActive || !hasPermission(actor, PERMISSION.ROLES.ASSIGN)) return false;
  if (isExplicitSuperAdmin(actor)) return ["SUPER_ADMIN", "ADMIN", "STAFF"].includes(role.baseRole);

  // Non-super administrators can delegate only a bounded STAFF role and only
  // when every grant in that role is already held by the acting administrator.
  return role.baseRole === "STAFF" && role.permissions.every((permission) => hasPermission(actor, permission));
}

export function canCreateStaff(actor: AuthorizationSnapshot) {
  return hasPermission(actor, PERMISSION.STAFF.CREATE)
    && hasPermission(actor, PERMISSION.ROLES.ASSIGN);
}

export function canAssignStaffRoles(actor: AuthorizationSnapshot) {
  return hasPermission(actor, PERMISSION.ROLES.ASSIGN);
}

export function canEditStaff(actor: AuthorizationSnapshot) {
  return hasPermission(actor, PERMISSION.STAFF.EDIT);
}

export function canDisableStaff(actor: AuthorizationSnapshot) {
  return hasPermission(actor, PERMISSION.STAFF.DISABLE);
}

/** Only a Super Admin may manage an ADMIN or SUPER_ADMIN account. */
export function canManageStaffTarget(
  actor: AuthorizationSnapshot,
  actorUserId: string,
  targetUserId: string,
  targetRoles: readonly Pick<IRole, "baseRole">[],
) {
  if (actorUserId === targetUserId) return false;
  const targetIsPrivileged = targetRoles.some((role) => role.baseRole === "SUPER_ADMIN" || role.baseRole === "ADMIN");
  return !targetIsPrivileged || isExplicitSuperAdmin(actor);
}

export function canApplyStaffStatus(actor: AuthorizationSnapshot, status: AccountStatus) {
  return status === "DISABLED" ? canDisableStaff(actor) : canEditStaff(actor);
}
