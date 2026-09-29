import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { WalletLedgerExplorer } from "@/components/admin/wallet-ledger-explorer";

export default function WalletLedgerPage() {
  return <>
    <AdminPageHeader eyebrow="Financial operations" title="Wallet ledger" description="Immutable, platform-wide history of credits, debits, reservations, reversals, and audited manual adjustments." />
    <WalletLedgerExplorer />
  </>;
}
