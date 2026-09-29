import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { getWalletLedgerTransaction } from "@/services/wallet/wallet-ledger-service";

export const GET = withApiErrorHandling(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  await requirePermission(PERMISSION.WALLET.VIEW_ALL, request);
  const { id } = await context.params;
  return apiSuccess(await getWalletLedgerTransaction(id));
});
