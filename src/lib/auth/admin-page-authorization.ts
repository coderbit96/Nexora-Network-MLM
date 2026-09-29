import "server-only";

import { forbidden, redirect } from "next/navigation";

import type { PermissionKey } from "@/config/permissions";
import { requireAuth, type AuthContext } from "@/lib/auth/authorization";
import { AppError } from "@/lib/errors/app-error";
import { hasPermission, hasRole } from "@/lib/auth/policy";
import type { ApplicationRoleName } from "@/types/domain";

function loginUrl(nextPath: string) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

/** The shell only distinguishes missing identity from an authenticated user. */
export async function requireAdminShell(nextPath = "/admin"): Promise<AuthContext> {
  try {
    return await requireAuth();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect(loginUrl(nextPath));
    if (!(error instanceof AppError) || error.statusCode !== 403) throw error;
    // A verified identity with an inactive application account belongs on the
    // same safe 403 boundary as an authenticated user missing a permission.
    forbidden();
  }
}

/**
 * Page-level UX guard. Individual route handlers continue to make their own
 * independent authorization decisions.
 */
export async function requireAdminPagePermission(permission: PermissionKey, nextPath: string, requiredRole?: ApplicationRoleName): Promise<AuthContext> {
  let context: AuthContext;
  try {
    context = await requireAuth();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect(loginUrl(nextPath));
    if (!(error instanceof AppError) || error.statusCode !== 403) throw error;
    forbidden();
  }

  if (!hasPermission(context, permission) || (requiredRole && !hasRole(context, requiredRole))) forbidden();
  return context;
}
