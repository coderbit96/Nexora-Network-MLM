import { AdminWithdrawalPanel } from "@/components/withdrawal/withdrawal-dashboard";

export default function AdminWithdrawalsPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Financial operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Withdrawal management</h1><p className="mt-2 text-muted-foreground">Process manually paid withdrawals through an auditable, controlled state machine.</p></div><AdminWithdrawalPanel /></>; }
