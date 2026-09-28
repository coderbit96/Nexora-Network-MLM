import "server-only";

import type { ClientSession, Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { MemberProfile, SponsorRelationship } from "@/models";
import { assertReferralAssignment } from "@/services/members/referral-validation";

/**
 * Validates a new immutable sponsor edge and materializes its upline path.
 * Call it in the same MongoDB transaction that creates the relationship.
 */
export async function resolveValidUpline({ memberProfileId, sponsorMemberProfileId, session }: { memberProfileId: Types.ObjectId; sponsorMemberProfileId: Types.ObjectId; session: ClientSession }) {
  const [member, sponsor, sponsorRelationship] = await Promise.all([
    MemberProfile.exists({ _id: memberProfileId }).session(session),
    MemberProfile.exists({ _id: sponsorMemberProfileId, activationStatus: "ACTIVE" }).session(session),
    SponsorRelationship.findOne({ memberProfileId: sponsorMemberProfileId }).session(session).lean(),
  ]);

  if (!member) throw errors.notFound("The member profile was not found.");
  const uplineMemberProfileIds = [sponsorMemberProfileId, ...(sponsorRelationship?.uplineMemberProfileIds ?? [])];
  assertReferralAssignment({ memberProfileId, sponsorMemberProfileId, sponsorStatus: sponsor ? "ACTIVE" : undefined, uplineMemberProfileIds });

  return uplineMemberProfileIds;
}
