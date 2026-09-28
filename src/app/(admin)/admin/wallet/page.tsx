import { AdminWalletPanel } from "@/components/wallet/wallet-dashboard";

export default function AdminWalletPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Financial operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Member wallets</h1><p className="mt-2 text-muted-foreground">Inspect ledger-backed balances and make auditable, permission-protected corrections.</p></div><AdminWalletPanel /></>; }
