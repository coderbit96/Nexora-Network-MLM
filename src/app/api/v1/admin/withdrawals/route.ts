import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { PERMISSION } from "@/config/permissions";
import { MemberProfile } from "@/models";
import { allowedAdministrativeWithdrawalTransitions } from "@/services/withdrawal/withdrawal-authorization";
import { getWithdrawalPage, parseWithdrawalFilters, serializeWithdrawal } from "@/services/withdrawal/withdrawal-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.WITHDRAWALS.VIEW_ALL, request);
  const page = await getWithdrawalPage(parseWithdrawalFilters(new URL(request.url).searchParams));
  const memberIds = page.withdrawals.map((withdrawal) => withdrawal.memberProfileId);
  const profiles = memberIds.length ? await MemberProfile.find({ _id: { $in: memberIds } }).select("firstName lastName memberNumber").lean() : [];
  const byId = new Map(profiles.map((profile) => [String(profile._id), profile]));
  return apiSuccess({
    canExport: hasPermission(context, PERMISSION.WITHDRAWALS.EXPORT),
    withdrawals: page.withdrawals.map((withdrawal) => {
      const profile = byId.get(String(withdrawal.memberProfileId));
      return {
        ...serializeWithdrawal(withdrawal),
        member: profile ? { memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}` } : null,
        allowedTransitions: allowedAdministrativeWithdrawalTransitions(context, withdrawal.status),
      };
    }),
    pagination: { total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages },
  });
});
