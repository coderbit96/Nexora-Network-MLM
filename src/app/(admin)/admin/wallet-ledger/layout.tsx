import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { requireAdminPagePermission } from "@/lib/auth/admin-page-authorization";

export default async function WalletLedgerLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPagePermission(ADMIN_PAGE_PERMISSION.walletTransactions, "/admin/wallet-ledger");
  return children;
}
