import type { ApplicationRoleName } from "@/types/domain";

export type WorkspacePath = "/admin" | "/staff" | "/member";

/**
 * Chooses the first workspace a signed-in user may enter. This is a UI routing
 * convenience only; every destination retains its own server authorization.
 */
export function defaultDashboardPath(roles: readonly ApplicationRoleName[]): WorkspacePath {
  if (roles.includes("SUPER_ADMIN") || roles.includes("ADMIN")) return "/admin";
  if (roles.includes("STAFF")) return "/staff";
  return "/member";
}

export function postLoginPath(nextPath: string | null, roles: readonly ApplicationRoleName[]): string {
  const workspace = defaultDashboardPath(roles);
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return workspace;
  if (workspace === "/admin" && nextPath.startsWith("/admin")) return nextPath;
  if (workspace === "/staff" && nextPath.startsWith("/staff")) return nextPath;
  if (workspace === "/member" && nextPath.startsWith("/member")) return nextPath;
  return workspace;
}
