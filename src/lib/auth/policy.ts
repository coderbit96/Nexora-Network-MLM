import { isApplicationRoleName, isPermissionKey, type PermissionKey } from "@/config/permissions";
import type { ApplicationRoleName, AccountStatus } from "@/types/domain";

/** Serializable authorization state resolved from MongoDB after Firebase identity verification. */
export type AuthorizationSnapshot = { status: AccountStatus; roles: ApplicationRoleName[]; permissions: PermissionKey[] };

export function isAccountActive(status: AccountStatus) {
  return status === "ACTIVE";
}

export function hasUsableApplicationAccess(snapshot: AuthorizationSnapshot) {
  return isAccountActive(snapshot.status) && snapshot.roles.length > 0;
}

export function hasRole(snapshot: AuthorizationSnapshot, role: unknown) {
  return hasUsableApplicationAccess(snapshot) && isApplicationRoleName(role) && (snapshot.roles.includes("SUPER_ADMIN") || snapshot.roles.includes(role));
}

export function hasAnyRole(snapshot: AuthorizationSnapshot, roles: readonly unknown[]) {
  return hasUsableApplicationAccess(snapshot) && roles.length > 0 && roles.every(isApplicationRoleName) && (snapshot.roles.includes("SUPER_ADMIN") || roles.some((role) => snapshot.roles.includes(role)));
}

/** Invalid values never pass, including for a Super Admin. */
export function hasPermission(snapshot: AuthorizationSnapshot, permission: unknown) {
  return hasUsableApplicationAccess(snapshot) && isPermissionKey(permission) && (snapshot.roles.includes("SUPER_ADMIN") || snapshot.permissions.includes(permission));
}

export function hasAnyPermission(snapshot: AuthorizationSnapshot, permissions: readonly unknown[]) {
  return hasUsableApplicationAccess(snapshot) && permissions.length > 0 && permissions.every(isPermissionKey) && permissions.some((permission) => hasPermission(snapshot, permission));
}

export function hasAllPermissions(snapshot: AuthorizationSnapshot, permissions: readonly unknown[]) {
  return hasUsableApplicationAccess(snapshot) && permissions.length > 0 && permissions.every((permission) => hasPermission(snapshot, permission));
}
