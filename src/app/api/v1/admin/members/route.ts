import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { MemberManagementService, parseMemberListFilters } from "@/services/members/member-management-service";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.MEMBERS.VIEW, request);
  return apiSuccess(await MemberManagementService.list(parseMemberListFilters(new URL(request.url).searchParams), hasPermission(context, PERMISSION.MEMBERS.VIEW_NETWORK)));
});
