import { redirect } from "next/navigation";

/** Retain the earlier URL for bookmarks while the dedicated ledger lives at /admin/wallet-ledger. */
export default function WalletTransactionsPage() {
  redirect("/admin/wallet-ledger");
}
