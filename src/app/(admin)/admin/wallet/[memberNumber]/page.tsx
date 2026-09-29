import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminWalletDetailPanel } from "@/components/wallet/wallet-dashboard";
import { Button } from "@/components/ui/button";

export default async function AdminWalletDetailPage({ params }: { params: Promise<{ memberNumber: string }> }) {
  const { memberNumber } = await params;
  return <><AdminPageHeader eyebrow="Financial operations" title="Wallet detail" description="Ledger-backed account summary and immutable transaction history." actions={<Button asChild variant="outline"><Link href="/admin/wallet"><ArrowLeft className="size-4" />All wallets</Link></Button>} /><AdminWalletDetailPanel memberNumber={memberNumber} /></>;
}
