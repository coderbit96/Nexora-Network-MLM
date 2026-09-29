import { AdminWalletPanel } from "@/components/wallet/wallet-dashboard";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminWalletPage() { return <><AdminPageHeader eyebrow="Financial operations" title="Member wallets" description="Inspect ledger-backed balances and make auditable, permission-protected corrections." /><AdminWalletPanel /></>; }
