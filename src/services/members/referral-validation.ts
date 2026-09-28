import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";

export function assertReferralAssignment({ memberProfileId, sponsorMemberProfileId, sponsorStatus, uplineMemberProfileIds }: { memberProfileId: Types.ObjectId; sponsorMemberProfileId?: Types.ObjectId; sponsorStatus?: string; uplineMemberProfileIds?: Types.ObjectId[] }) {
  if (!sponsorMemberProfileId) throw errors.badRequest("The referral code is invalid.");
  if (sponsorStatus !== "ACTIVE") throw errors.badRequest("The referral sponsor is not active.");
  if (memberProfileId.equals(sponsorMemberProfileId) || uplineMemberProfileIds?.some((id) => id.equals(memberProfileId))) {
    throw errors.badRequest("This referral would create a circular sponsorship relationship.");
  }
}
