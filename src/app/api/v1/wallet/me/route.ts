import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { getWalletOverview, getWalletTransactionPage, parseWalletFilters, serializeWallet, serializeWalletTransaction } from "@/services/wallet/wallet-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireRole("MEMBER", request);
  const profile = await getMemberProfileByUserId(context.user._id);
  const filters = parseWalletFilters(new URL(request.url).searchParams);
  const [wallet, history] = await Promise.all([getWalletOverview(profile._id), getWalletTransactionPage(profile._id, filters)]);
  return apiSuccess({ wallet: serializeWallet(wallet), transactions: history.transactions.map(serializeWalletTransaction), pagination: { total: history.total, page: history.page, limit: history.limit, totalPages: history.totalPages } });
});
