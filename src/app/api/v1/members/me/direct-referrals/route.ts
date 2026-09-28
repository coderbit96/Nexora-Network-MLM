import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";
import { MemberProfile, SponsorRelationship } from "@/models";
import { getMemberProfileByUserId } from "@/services/members/member-profile";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  const profile = await getMemberProfileByUserId(context.user._id);
  const relations = await SponsorRelationship.find({ sponsorMemberProfileId: profile._id }).sort({ createdAt: -1 }).limit(100).lean();
  const profiles = await MemberProfile.find({ _id: { $in: relations.map((relation) => relation.memberProfileId) } }).select("firstName lastName memberNumber activationStatus joinedAt").lean();
  const byId = new Map(profiles.map((member) => [String(member._id), member]));
  return apiSuccess({ total: relations.length, referrals: relations.flatMap((relation) => { const member = byId.get(String(relation.memberProfileId)); return member ? [{ memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, status: member.activationStatus, joinedAt: member.joinedAt }] : []; }) });
});
