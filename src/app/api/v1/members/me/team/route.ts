import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";
import { MemberProfile, SponsorRelationship } from "@/models";
import { getMemberProfileByUserId, getReferralStatistics } from "@/services/members/member-profile";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  const profile = await getMemberProfileByUserId(context.user._id);
  const [statistics, relations] = await Promise.all([getReferralStatistics(profile._id), SponsorRelationship.find({ uplineMemberProfileIds: profile._id }).sort({ createdAt: -1 }).limit(100).lean()]);
  const profiles = await MemberProfile.find({ _id: { $in: relations.map((relation) => relation.memberProfileId) } }).select("firstName lastName memberNumber activationStatus joinedAt").lean();
  const byId = new Map(profiles.map((member) => [String(member._id), member]));
  return apiSuccess({ statistics, members: relations.flatMap((relation) => { const member = byId.get(String(relation.memberProfileId)); const level = relation.uplineMemberProfileIds.findIndex((id) => id.equals(profile._id)) + 1; return member ? [{ memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, status: member.activationStatus, joinedAt: member.joinedAt, level }] : []; }) });
});
