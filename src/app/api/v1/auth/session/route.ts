import { NextResponse } from "next/server";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionCookie, getAuthContext } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { parseJsonBody } from "@/lib/validation/request";
import { sessionSchema } from "@/lib/validation/auth";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { User } from "@/models";

export const POST = withApiErrorHandling(async (request: Request) => {
  enforceRateLimit(`session:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 30, 60_000);
  const { idToken } = await parseJsonBody(request, sessionSchema);
  const cookie = await createSessionCookie(idToken);
  const context = await getAuthContext(new Request(request.url, { headers: { authorization: `Bearer ${idToken}` } }));
  // A Firebase token proves identity only. A session is issued only after the
  // application account is active and has at least one active application role.
  if (context.status !== "ACTIVE" || context.roles.length === 0) throw errors.forbidden("Your application account is not active.");
  // This is written only after both Firebase identity verification and the
  // MongoDB application-access checks have succeeded.
  await User.updateOne({ _id: context.user._id }, { $set: { lastLoginAt: new Date() } });
  const response = apiSuccess({ status: context.status, roles: context.roles });
  response.cookies.set(SESSION_COOKIE_NAME, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: SESSION_MAX_AGE_SECONDS, path: "/" });
  return response;
});

export const DELETE = withApiErrorHandling(async () => {
  const response = NextResponse.json({ success: true, data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
});
