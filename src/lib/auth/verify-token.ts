import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";

import { errors } from "@/lib/errors/app-error";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";

export async function verifyFirebaseIdToken(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw errors.unauthorized();

  try {
    return await getFirebaseAdminAuth().verifyIdToken(authorization.slice(7), true);
  } catch (error) {
    // Configuration failures must surface as server errors, not misleading invalid-session responses.
    if (error instanceof Error && error.name === "ZodError") throw error;
    throw errors.unauthorized("Your session is invalid or has expired.");
  }
}
