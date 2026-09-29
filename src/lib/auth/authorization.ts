import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Types } from "mongoose";

import { isApplicationRoleName, isPermissionKey, type PermissionKey } from "@/config/permissions";
import { errors } from "@/lib/errors/app-error";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-token";
import { hasAllPermissions, hasAnyPermission, hasAnyRole, hasPermission, hasRole, hasUsableApplicationAccess, isAccountActive, type AuthorizationSnapshot } from "@/lib/auth/policy";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Role, User } from "@/models";
import type { ApplicationRoleName, IUser } from "@/types/domain";

export const SESSION_COOKIE_NAME = "mlm_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

// Re-exported from the server-side authorization boundary for use by services
// and route handlers. These functions only accept catalog-defined keys at
// runtime; arbitrary strings do not pass even for Super Admin.
export { hasAllPermissions, hasAnyPermission, hasPermission, hasRole } from "@/lib/auth/policy";

export type AuthContext = AuthorizationSnapshot & { firebase: DecodedIdToken; user: IUser & { _id: Types.ObjectId }; userId: string };

async function resolveApplicationUser(firebase: DecodedIdToken): Promise<AuthContext> {
  await connectToDatabase();
  const user = await User.findOne({ firebaseUid: firebase.uid }).lean();
  if (!user) throw errors.unauthorized("Your application account has not been initialized.");
  // Inactive roles cannot grant access, including to accounts that were assigned
  // the role before it was retired.
  const roles = await Role.find({ _id: { $in: user.roleIds }, isActive: true }).lean();
  const permissions = [...new Set(roles.flatMap((role) => role.permissions))] as PermissionKey[];
  // A custom role (for example, Finance Manager) obtains its route boundary
  // from `baseRole`; display names must never be treated as trusted roles.
  const roleNames = [...new Set(roles.map((role) => role.baseRole))] as ApplicationRoleName[];
  return { firebase, user: user as IUser & { _id: Types.ObjectId }, userId: String(user._id), status: user.status, roles: roleNames, permissions };
}

export async function getAuthContext(request?: Request) {
  if (request?.headers.get("authorization")) return resolveApplicationUser(await verifyFirebaseIdToken(request));
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) throw errors.unauthorized();
  let firebase: DecodedIdToken;
  try { firebase = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true); }
  catch (error) {
    // Surface configuration failures as 5xx rather than falsely treating every user as unauthorized.
    if (error instanceof Error && error.name === "ZodError") throw error;
    throw errors.unauthorized("Your session is invalid or has expired.");
  }
  // Database failures are server failures, not invalid login sessions.
  return resolveApplicationUser(firebase);
}

export async function requireAuth(request?: Request) {
  const context = await getAuthContext(request);
  if (!isAccountActive(context.status)) {
    if (context.status === "PENDING") throw errors.forbidden("Please verify your email address before continuing.");
    throw errors.forbidden("Your account is not active.");
  }
  if (!hasUsableApplicationAccess(context)) {
    throw errors.forbidden("Your application access role is inactive or unavailable.");
  }
  return context;
}

export async function requireRole(role: ApplicationRoleName, request?: Request) {
  const context = await requireAuth(request);
  if (!hasRole(context, role)) throw errors.forbidden();
  return context;
}

export async function requireAnyRole(roles: readonly ApplicationRoleName[], request?: Request) {
  const context = await requireAuth(request);
  if (!roles.length || !roles.every(isApplicationRoleName) || !hasAnyRole(context, roles)) throw errors.forbidden();
  return context;
}

export async function requirePermission(permission: PermissionKey, request?: Request) {
  const context = await requireAuth(request);
  if (!isPermissionKey(permission) || !hasPermission(context, permission)) throw errors.forbidden();
  return context;
}

export async function requireAnyPermission(permissions: readonly PermissionKey[], request?: Request) {
  const context = await requireAuth(request);
  if (!permissions.length || !permissions.every(isPermissionKey) || !hasAnyPermission(context, permissions)) throw errors.forbidden();
  return context;
}

export async function requireAllPermissions(permissions: readonly PermissionKey[], request?: Request) {
  const context = await requireAuth(request);
  if (!permissions.length || !permissions.every(isPermissionKey) || !hasAllPermissions(context, permissions)) throw errors.forbidden();
  return context;
}

export async function createSessionCookie(idToken: string) {
  await getFirebaseAdminAuth().verifyIdToken(idToken);
  return getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
}
