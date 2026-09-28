import "server-only";

import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { MemberPaymentDetails, MemberProfile, SponsorRelationship } from "@/models";

export async function getMemberProfileByUserId(userId: Types.ObjectId) {
  const profile = await MemberProfile.findOne({ userId }).lean();
  if (!profile) throw errors.notFound("Your member profile was not found.");
  return profile;
}

export async function getReferralStatistics(memberProfileId: Types.ObjectId) {
  const [directReferrals, teamMembers] = await Promise.all([
    SponsorRelationship.countDocuments({ sponsorMemberProfileId: memberProfileId }),
    SponsorRelationship.countDocuments({ uplineMemberProfileIds: memberProfileId }),
  ]);
  return { directReferrals, teamMembers };
}

export async function getMaskedPaymentDetails(memberProfileId: Types.ObjectId) {
  const payment = await MemberPaymentDetails.findOne({ memberProfileId }).select("accountLast4 updatedAt").lean();
  return payment ? { configured: true, accountLast4: payment.accountLast4, updatedAt: payment.updatedAt } : { configured: false, accountLast4: null, updatedAt: null };
}
