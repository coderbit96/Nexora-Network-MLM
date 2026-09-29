import "server-only";

import { randomBytes } from "crypto";
import { type ClientSession, startSession, Types } from "mongoose";

import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import type { AuthContext } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import type { CreateStaffInput } from "@/lib/validation/staff";
import { MemberProfile, Notification, Role, SponsorRelationship, SystemCounter, User, Wallet } from "@/models";
import { canAssignMemberRole, type AssignableStaffRole } from "@/services/auth/staff-authorization";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";
import { resolveValidUpline } from "@/services/genealogy/sponsor-assignment";
import { SystemSettingsService } from "@/services/settings/system-settings-service";

type MemberAuditInput = AuditRequestContext & { actorUserId: Types.ObjectId };

function generateReferralCode() { return randomBytes(5).toString("hex").toUpperCase(); }

function profileStatus(status: CreateStaffInput["status"]) {
  return status === "DISABLED" ? "INACTIVE" : status;
}

async function nextMemberNumber(session: ClientSession) {
  const counter = await SystemCounter.findByIdAndUpdate(
    "member-number",
    { $inc: { sequence: 1 } },
    { returnDocument: "after", upsert: true, session, setDefaultsOnInsert: true },
  );
  if (!counter) throw new Error("Could not allocate a member number.");
  return `MLM${counter.sequence.toString().padStart(6, "0")}`;
}

async function loadAssignableMemberRole(roleId: string, actor: AuthContext, session?: ClientSession) {
  const query = Role.findById(roleId).select("name slug baseRole permissions isActive");
  if (session) query.session(session);
  const role = await query.lean();
  if (!role || !canAssignMemberRole(actor, role as AssignableStaffRole)) throw errors.forbidden();
  return role as AssignableStaffRole;
}

function firebaseError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "auth/email-already-exists") return errors.conflict("A Firebase account already exists for this email address.");
  return errors.conflict("The Firebase identity could not be synchronized.");
}

/**
 * Administrative member provisioning. Unlike a team-account creation, this
 * atomically creates the member profile, wallet, referral identity, and any
 * chosen sponsor relationship before the Firebase identity is retained.
 */
export class MemberAccountService {
  static async create(input: CreateStaffInput, actor: AuthContext, audit: MemberAuditInput) {
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    if (!firstName || !lastName) throw errors.badRequest("First and last name are required for a member account.");
    await connectToDatabase();
    await loadAssignableMemberRole(input.roleId, actor);
    if (await User.exists({ email: input.email })) throw errors.conflict("An application account already exists for this email address.");

    const sponsorCode = input.sponsorReferralCode?.trim().toUpperCase();
    if (sponsorCode) {
      const sponsor = await MemberProfile.exists({ referralCode: sponsorCode, activationStatus: "ACTIVE" });
      if (!sponsor) throw errors.badRequest("The sponsor referral code is invalid or the sponsor is not active.");
    }

    let firebaseUid: string | undefined;
    try {
      const firebaseUser = await getFirebaseAdminAuth().createUser({
        email: input.email,
        password: input.password,
        displayName: `${firstName} ${lastName}`,
        // An ACTIVE account is explicitly approved by an authorized operator.
        // Pending accounts still follow the normal Firebase verification flow.
        emailVerified: input.status === "ACTIVE",
        disabled: input.status === "DISABLED",
      });
      firebaseUid = firebaseUser.uid;
      const session = await startSession();
      try {
        let created: { id: string; memberNumber: string; referralCode: string } | undefined;
        await session.withTransaction(async () => {
          if (await User.exists({ email: input.email }).session(session)) throw errors.conflict("An application account already exists for this email address.");
          const role = await loadAssignableMemberRole(input.roleId, actor, session);
          const [user] = await User.create([{ firebaseUid: firebaseUser.uid, email: input.email, displayName: `${firstName} ${lastName}`, status: input.status, roleIds: [role._id] }], { session });
          const memberNumber = await nextMemberNumber(session);
          let referralCode = "";
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const candidate = generateReferralCode();
            if (!(await MemberProfile.exists({ referralCode: candidate }).session(session))) { referralCode = candidate; break; }
          }
          if (!referralCode) throw errors.conflict("A unique member referral code could not be generated. Please retry.");
          const [profile] = await MemberProfile.create([{
            userId: user._id, memberNumber, referralCode, firstName, lastName, activationStatus: profileStatus(input.status),
          }], { session });
          if (sponsorCode) {
            const sponsor = await MemberProfile.findOne({ referralCode: sponsorCode, activationStatus: "ACTIVE" }).session(session).lean();
            if (!sponsor) throw errors.badRequest("The sponsor referral code is invalid or the sponsor is not active.");
            const uplines = await resolveValidUpline({ memberProfileId: profile._id, sponsorMemberProfileId: sponsor._id, session });
            await SponsorRelationship.create([{ memberProfileId: profile._id, sponsorMemberProfileId: sponsor._id, uplineMemberProfileIds: uplines }], { session });
            await Notification.create([{ userId: sponsor.userId, type: "ACCOUNT", title: "New direct referral", body: `${firstName} ${lastName} was added to your referral network.`, actionUrl: "/member/direct-referrals", metadata: { memberProfileId: String(profile._id) } }], { session });
          }
          const configuration = await SystemSettingsService.read(session);
          await Wallet.create([{ memberProfileId: profile._id, currency: configuration.settings.currency, availableMinor: 0n, heldMinor: 0n, lifetimeCreditMinor: 0n, lifetimeDebitMinor: 0n, lifetimeEarningsMinor: 0n, lifetimeWithdrawalsMinor: 0n }], { session });
          await Notification.create([{ userId: user._id, type: "ACCOUNT", title: "Welcome to Nexora", body: input.status === "ACTIVE" ? "Your member account is ready to use." : "Your member account has been created. Verify your email to activate your workspace.", actionUrl: input.status === "ACTIVE" ? "/member" : "/verify-email" }], { session });
          await AuditService.record({ ...audit, action: "member.created", resourceType: "User", resourceId: String(user._id), after: { email: user.email, status: user.status, role: { id: String(role._id), name: role.name, baseRole: role.baseRole }, memberNumber, referralCode, ...(sponsorCode ? { sponsorReferralCode: sponsorCode } : {}) } }, session);
          created = { id: String(user._id), memberNumber, referralCode };
        });
        if (!created) throw new Error("Member account was not created.");
        return created;
      } finally { await session.endSession(); }
    } catch (error) {
      if (firebaseUid) {
        try { await getFirebaseAdminAuth().deleteUser(firebaseUid); } catch { /* A reconciliation task can safely remove an orphaned identity. */ }
      }
      if (error instanceof Error && error.name === "AppError") throw error;
      throw firebaseError(error);
    }
  }
}
