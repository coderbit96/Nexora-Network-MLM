import { PERMISSION } from "@/config/permissions";
import { withApiErrorHandling } from "@/lib/api";
import { requireAllPermissions } from "@/lib/auth/authorization";
import { createWalletLedgerCsvStream, parseWalletLedgerFilters } from "@/services/wallet/wallet-ledger-service";

/** A streamed export; VIEW_ALL alone never grants the ability to extract ledger data. */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requireAllPermissions([PERMISSION.WALLET.VIEW_ALL, PERMISSION.WALLET.EXPORT], request);
  const stream = await createWalletLedgerCsvStream(parseWalletLedgerFilters(new URL(request.url).searchParams));
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="wallet-ledger.csv"',
      "cache-control": "no-store",
    },
  });
});
