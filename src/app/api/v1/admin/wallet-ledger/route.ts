import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { getWalletLedgerPage, parseWalletLedgerFilters } from "@/services/wallet/wallet-ledger-service";

/** Read-only, platform-wide immutable wallet ledger. */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.WALLET.VIEW_ALL, request);
  return apiSuccess(await getWalletLedgerPage(parseWalletLedgerFilters(new URL(request.url).searchParams)));
});
