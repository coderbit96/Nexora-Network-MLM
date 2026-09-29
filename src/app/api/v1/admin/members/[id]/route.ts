import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission, requireRole } from "@/lib/auth/authorization";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { adminMemberProfileUpdateSchema, adminMemberStatusSchema } from "@/lib/validation/member";
import { parseJsonBody } from "@/lib/validation/request";
import { MemberManagementService } from "@/services/members/member-management-service";

type Context = { params: Promise<{ id: string }> };

export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const context = await requirePermission(PERMISSION.MEMBERS.VIEW, request);
  const access = { network: hasPermission(context, PERMISSION.MEMBERS.VIEW_NETWORK), financials: hasPermission(context, PERMISSION.MEMBERS.VIEW_FINANCIALS), orders: hasPermission(context, PERMISSION.ORDERS.VIEW_ALL), audit: hasPermission(context, PERMISSION.AUDIT.VIEW) };
  return apiSuccess({ ...(await MemberManagementService.detail((await params).id, access)), canManage: context.roles.includes("SUPER_ADMIN") });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const context = await requireRole("SUPER_ADMIN", request);
  const input = await parseJsonBody(request, adminMemberProfileUpdateSchema);
  await MemberManagementService.updateProfile((await params).id, input, context.user._id, getAuditRequestContext(request));
  return apiSuccess({ updated: true });
});

export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const context = await requireRole("SUPER_ADMIN", request);
  const input = await parseJsonBody(request, adminMemberStatusSchema);
  await MemberManagementService.changeStatus((await params).id, input, context.user._id, getAuditRequestContext(request));
  return apiSuccess({ updated: true });
});
