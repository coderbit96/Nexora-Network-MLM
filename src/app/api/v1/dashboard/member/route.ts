import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { getMemberDashboard } from "@/services/dashboard/member-dashboard";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireRole("MEMBER", request);
  const profile = await getMemberProfileByUserId(context.user._id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return apiSuccess(await getMemberDashboard(profile._id, baseUrl));
});
