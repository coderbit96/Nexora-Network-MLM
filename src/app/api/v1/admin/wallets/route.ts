import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { getWalletAccountPage, parseWalletListFilters } from "@/services/wallet/wallet-query";

/** Paginated account summaries only; ledger detail remains member-scoped. */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.WALLET.VIEW_ALL, request);
  return apiSuccess(await getWalletAccountPage(parseWalletListFilters(new URL(request.url).searchParams)));
});
