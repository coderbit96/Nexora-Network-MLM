import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";
import { MemberProfile, SponsorRelationship } from "@/models";
import { getMemberProfileByUserId, getReferralStatistics } from "@/services/members/member-profile";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  const profile = await getMemberProfileByUserId(context.user._id);
  const [statistics, sponsorRelationship] = await Promise.all([getReferralStatistics(profile._id), SponsorRelationship.findOne({ memberProfileId: profile._id }).lean()]);
  const sponsor = sponsorRelationship ? await MemberProfile.findById(sponsorRelationship.sponsorMemberProfileId).select("firstName lastName memberNumber referralCode").lean() : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return apiSuccess({ referralCode: profile.referralCode, referralUrl: `${baseUrl.replace(/\/$/, "")}/register?ref=${encodeURIComponent(profile.referralCode)}`, statistics, sponsor: sponsor ? { name: `${sponsor.firstName} ${sponsor.lastName}`, memberNumber: sponsor.memberNumber } : null });
});
