import "server-only";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { EMAIL_VERIFICATION_ACTIVATABLE_STATUSES } from "@/lib/auth/email-verification";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-token";
import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { MemberProfile, User } from "@/models";

export const POST = withApiErrorHandling(async (request: Request) => {
  const token = await verifyFirebaseIdToken(request);
  const firebaseUser = await getFirebaseAdminAuth().getUser(token.uid);
  if (!firebaseUser.emailVerified) throw errors.badRequest("Your email address has not been verified yet.");
  await connectToDatabase();

  // This operation is deliberately idempotent and does not require a MongoDB
  // transaction. Requiring `withTransaction` here made every verified login
  // fail on valid standalone MongoDB deployments (transactions require a
  // replica set or mongos). The conditional update prevents email verification
  // from reactivating a suspended or disabled application account.
  const user = await User.findOneAndUpdate(
    { firebaseUid: token.uid, status: { $in: EMAIL_VERIFICATION_ACTIVATABLE_STATUSES } },
    { $set: { status: "ACTIVE" } },
    { returnDocument: "after" },
  );

  if (!user) {
    const existing = await User.exists({ firebaseUid: token.uid });
    if (!existing) throw errors.unauthorized("Your application account has not been initialized.");
    // A verified Firebase identity must not override a deliberate application
    // suspension or disablement. Session creation will return the appropriate
    // access denial for that account state.
    return apiSuccess({ verified: true, activated: false });
  }

  // Re-run this safe update for already-active users too. It heals a rare
  // interrupted activation where the User became ACTIVE before its related
  // member profile was marked active, without changing financial data.
  await MemberProfile.updateOne(
    { userId: user._id, activationStatus: "PENDING" },
    { $set: { activationStatus: "ACTIVE" } },
  );

  return apiSuccess({ verified: true });
});
