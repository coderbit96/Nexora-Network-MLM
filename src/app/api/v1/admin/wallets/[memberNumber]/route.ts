import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { decimalToMinorUnits } from "@/lib/money/minor-units";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { adminWalletAdjustmentSchema } from "@/lib/validation/wallet";
import { MemberProfile } from "@/models";
import { parseJsonBody } from "@/lib/validation/request";
import { getWalletOverview, getWalletTransactionPage, parseWalletFilters, serializeWallet, serializeWalletTransaction } from "@/services/wallet/wallet-query";
import { WalletService } from "@/services/wallet/wallet-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

type Context = { params: Promise<{ memberNumber: string }> };

async function findMember(memberNumber: string) {
  const profile = await MemberProfile.findOne({ memberNumber: memberNumber.trim().toUpperCase() }).select("firstName lastName memberNumber activationStatus").lean();
  if (!profile) throw errors.notFound("Member was not found.");
  return profile;
}

export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const context = await requirePermission(PERMISSION.WALLET.VIEW_ALL, request);
  const profile = await findMember((await params).memberNumber);
  const filters = parseWalletFilters(new URL(request.url).searchParams);
  const [wallet, history] = await Promise.all([getWalletOverview(profile._id), getWalletTransactionPage(profile._id, filters)]);
  return apiSuccess({ member: { memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`, status: profile.activationStatus }, wallet: serializeWallet(wallet), transactions: history.transactions.map(serializeWalletTransaction), pagination: { total: history.total, page: history.page, limit: history.limit, totalPages: history.totalPages }, capabilities: { adjust: hasPermission(context, PERMISSION.WALLET.ADJUST) } });
});

export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const context = await requirePermission(PERMISSION.WALLET.ADJUST, request);
  enforceRateLimit(`wallet-adjust:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 20, 60_000);
  const profile = await findMember((await params).memberNumber);
  const wallet = await getWalletOverview(profile._id);
  const body = await parseJsonBody(request, adminWalletAdjustmentSchema);
  let amountMinor: bigint;
  try { amountMinor = decimalToMinorUnits(body.amount); } catch { throw errors.badRequest("Invalid adjustment amount."); }
  const result = await WalletService.adjustByAdmin({
    actorUserId: context.user._id, memberProfileId: profile._id, currency: wallet.currency, direction: body.direction,
    amountMinor, reason: body.reason, idempotencyKey: `admin-wallet-adjustment:${body.idempotencyKey}`, ...getAuditRequestContext(request),
  });
  return apiSuccess({ created: result.created, transaction: { id: result.transaction.id, resultingAvailableMinor: result.transaction.resultingAvailableMinor.toString() } }, { status: result.created ? 201 : 200 });
});
