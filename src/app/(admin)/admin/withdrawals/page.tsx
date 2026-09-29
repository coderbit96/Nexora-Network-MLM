import { AdminWithdrawalManager } from "@/components/admin/withdrawal-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminWithdrawalsPage() { return <><AdminPageHeader eyebrow="Financial operations" title="Withdrawal management" description="Process manually paid withdrawals through an auditable, controlled state machine." /><AdminWithdrawalManager /></>; }
