import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requireRole } from "@/lib/auth/authorization";
import { PERMISSION } from "@/config/permissions";
import { errors } from "@/lib/errors/app-error";
import { decimalToMinorUnits } from "@/lib/money/minor-units";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { withdrawalRequestSchema } from "@/lib/validation/withdrawal";
import { parseJsonBody } from "@/lib/validation/request";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { getWithdrawalPage, parseWithdrawalFilters, serializeWithdrawal } from "@/services/withdrawal/withdrawal-query";
import { WithdrawalService } from "@/services/withdrawal/withdrawal-service";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireRole("MEMBER", request);
  if (!hasPermission(context, PERMISSION.WITHDRAWALS.VIEW)) throw errors.forbidden();
  const profile = await getMemberProfileByUserId(context.user._id);
  const page = await getWithdrawalPage(parseWithdrawalFilters(new URL(request.url).searchParams), profile._id);
  return apiSuccess({ withdrawals: page.withdrawals.map(serializeWithdrawal), pagination: { total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages } });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const context = await requireRole("MEMBER", request); enforceRateLimit(`withdrawal-request:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 10, 60_000);
  const profile = await getMemberProfileByUserId(context.user._id); const body = await parseJsonBody(request, withdrawalRequestSchema);
  let amountMinor: bigint; try { amountMinor = decimalToMinorUnits(body.amount); } catch { throw errors.badRequest("Invalid withdrawal amount."); }
  const result = await WithdrawalService.request({ memberProfileId: profile._id, amountMinor, idempotencyKey: body.idempotencyKey });
  return apiSuccess(result, { status: result.created ? 201 : 200 });
});
