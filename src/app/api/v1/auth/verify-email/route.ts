import "server-only";

import { startSession } from "mongoose";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
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
  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate({ firebaseUid: token.uid, status: "PENDING" }, { $set: { status: "ACTIVE" } }, { new: true, session });
      if (!user) {
        const existing = await User.exists({ firebaseUid: token.uid }).session(session);
        if (!existing) throw errors.unauthorized("Your application account has not been initialized.");
      } else {
        await MemberProfile.updateOne({ userId: user._id, activationStatus: "PENDING" }, { $set: { activationStatus: "ACTIVE" } }, { session });
      }
    });
  } finally { await session.endSession(); }
  return apiSuccess({ verified: true });
});
