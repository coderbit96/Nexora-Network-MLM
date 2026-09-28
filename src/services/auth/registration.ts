import "server-only";

import { randomBytes } from "crypto";
import { type ClientSession, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { MemberProfile, Notification, SponsorRelationship, SystemCounter, User, Wallet } from "@/models";
import { resolveValidUpline } from "@/services/genealogy/sponsor-assignment";
import { ensureSystemRbac, getRoleId } from "@/services/auth/rbac";
import { SystemSettingsService } from "@/services/settings/system-settings-service";

type RegisterInput = { email: string; password: string; firstName: string; lastName: string; referralCode?: string };

function generateReferralCode() { return randomBytes(5).toString("hex").toUpperCase(); }

async function nextMemberNumber(session: ClientSession) {
  const counter = await SystemCounter.findByIdAndUpdate("member-number", { $inc: { sequence: 1 } }, { new: true, upsert: true, session, setDefaultsOnInsert: true });
  if (!counter) throw new Error("Could not allocate a member number.");
  return `MLM${counter.sequence.toString().padStart(6, "0")}`;
}

/** Creates Firebase and MongoDB identities with Firebase cleanup on database failure. */
export async function registerApplicationUser(input: RegisterInput) {
  const adminAuth = getFirebaseAdminAuth();
  let firebaseUid: string | undefined;
  try {
    await connectToDatabase();
    if (input.referralCode) {
      const sponsor = await MemberProfile.exists({ referralCode: input.referralCode.toUpperCase(), activationStatus: "ACTIVE" });
      if (!sponsor) throw errors.badRequest("The referral code is invalid or the sponsor is not active.");
    }
    const firebaseUser = await adminAuth.createUser({ email: input.email, password: input.password, displayName: `${input.firstName} ${input.lastName}`.trim(), emailVerified: false });
    firebaseUid = firebaseUser.uid;
    const session = await startSession();
    try {
      let memberNumber = "";
      let referralCode = "";
      await session.withTransaction(async () => {
        await ensureSystemRbac(session);
        // Public registration never consumes a role from the request. The sole
        // role source is the active MEMBER system role resolved server-side.
        const memberRoleId = await getRoleId("MEMBER", session);
        const user = await User.create([{ firebaseUid: firebaseUser.uid, email: input.email, displayName: firebaseUser.displayName, status: "PENDING", roleIds: [memberRoleId] }], { session });
        memberNumber = await nextMemberNumber(session);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          referralCode = generateReferralCode();
          if (referralCode !== input.referralCode?.toUpperCase() && !(await MemberProfile.exists({ referralCode }).session(session))) break;
        }
        const profile = await MemberProfile.create([{ userId: user[0]._id, memberNumber, referralCode, firstName: input.firstName, lastName: input.lastName, activationStatus: "PENDING" }], { session });
        if (input.referralCode) {
          const sponsor = await MemberProfile.findOne({ referralCode: input.referralCode.toUpperCase() }).session(session).lean();
          if (!sponsor) throw errors.badRequest("The referral code is invalid.");
          const uplines = await resolveValidUpline({ memberProfileId: profile[0]._id, sponsorMemberProfileId: sponsor._id, session });
          await SponsorRelationship.create([{ memberProfileId: profile[0]._id, sponsorMemberProfileId: sponsor._id, uplineMemberProfileIds: uplines }], { session });
          await Notification.create([{ userId: sponsor.userId, type: "ACCOUNT", title: "New direct referral", body: `${input.firstName} ${input.lastName} registered using your referral code.`, actionUrl: "/member/direct-referrals", metadata: { memberProfileId: String(profile[0]._id) } }], { session });
        }
        const configuration = await SystemSettingsService.read(session);
        await Wallet.create([{ memberProfileId: profile[0]._id, currency: configuration.settings.currency, availableMinor: 0n, heldMinor: 0n, lifetimeCreditMinor: 0n, lifetimeDebitMinor: 0n, lifetimeEarningsMinor: 0n, lifetimeWithdrawalsMinor: 0n }], { session });
        await Notification.create([{ userId: user[0]._id, type: "ACCOUNT", title: "Welcome to Nexora", body: "Your member account has been created. Verify your email to activate your workspace.", actionUrl: "/verify-email" }], { session });
      });
      return { firebaseUid: firebaseUser.uid, memberNumber, referralCode };
    } finally { await session.endSession(); }
  } catch (error) {
    if (firebaseUid) {
      try { await adminAuth.deleteUser(firebaseUid); } catch { /* A reconciliation task can safely retry synchronization if cleanup is unavailable. */ }
    }
    throw error;
  }
}
