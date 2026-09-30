"use client";

import { Download, Eye, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

const transactionTypes = ["DIRECT_COMMISSION", "LEVEL_COMMISSION", "WITHDRAWAL_RESERVATION", "WITHDRAWAL", "WITHDRAWAL_RELEASE", "WITHDRAWAL_REVERSAL", "ADMIN_CREDIT", "ADMIN_DEBIT", "ORDER_REFUND_ADJUSTMENT", "OTHER"] as const;
type Transaction = {
  id: string; member: { memberNumber: string; name: string } | null; memberProfileId: string; direction: "CREDIT" | "DEBIT"; type: string; amountMinor: string; currency: string;
  referenceType: string; referenceId: string; description: string; resultingAvailableMinor: string; resultingHeldMinor: string; createdAt: string;
};
type Filters = { member: string; direction: string; type: string; reference: string; minAmount: string; maxAmount: string; from: string; to: string };
type LedgerData = { items: Transaction[]; pagination: { total: number; page: number; limit: number; totalPages: number } };
type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
const emptyFilters = (): Filters => ({ member: "", direction: "", type: "", reference: "", minAmount: "", maxAmount: "", from: "", to: "" });

async function request<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.success) throw new Error(payload.success ? "The request could not be completed." : payload.error?.message ?? "The request could not be completed.");
  return payload.data;
}

function ledgerQuery(filters: Filters, page: number) {
  return new URLSearchParams({
    page: String(page), limit: "25",
    ...(filters.member.trim() ? { member: filters.member.trim() } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.reference.trim() ? { reference: filters.reference.trim() } : {}),
    ...(filters.minAmount.trim() ? { minAmount: filters.minAmount.trim() } : {}),
    ...(filters.maxAmount.trim() ? { maxAmount: filters.maxAmount.trim() } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }).toString();
}

export function WalletLedgerExplorer() {
  const searchParams = useSearchParams();
  const initialFilters = (): Filters => ({ ...emptyFilters(), member: searchParams.get("member")?.trim().slice(0, 100) ?? "", reference: searchParams.get("reference")?.trim().slice(0, 100) ?? "" });
  const [draft, setDraft] = useState<Filters>(initialFilters); const [filters, setFilters] = useState<Filters>(initialFilters); const [page, setPage] = useState(1);
  const [data, setData] = useState<LedgerData | null>(null); const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null); const [detailOpen, setDetailOpen] = useState(false); const [detailError, setDetailError] = useState<string | null>(null); const [detailLoading, setDetailLoading] = useState(false);
  const query = useMemo(() => ledgerQuery(filters, page), [filters, page]);
  const load = useCallback(async () => {
    try { setError(null); setData(await request<LedgerData>(`/api/v1/admin/wallet-ledger?${query}`)); }
    catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "Wallet ledger could not be loaded."); }
  }, [query]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const apply = () => { setFilters(draft); setPage(1); };
  const reset = () => { const next = emptyFilters(); setDraft(next); setFilters(next); setPage(1); };
  const openDetail = async (id: string) => {
    setDetailOpen(true); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await request<Transaction>(`/api/v1/admin/wallet-ledger/${id}`)); }
    catch (cause) { setDetailError(cause instanceof Error ? cause.message : "Transaction details could not be loaded."); }
    finally { setDetailLoading(false); }
  };
  const exportHref = `/api/v1/admin/wallet-ledger/export?${ledgerQuery(filters, 1)}`;

  if (!data && !error) return <Skeleton className="h-[32rem]" />;
  if (error || !data) return <ErrorState title="Wallet ledger could not be loaded" description={error ?? "Check your wallet permissions and try again."} action={<Button onClick={() => void load()}>Try again</Button>} />;

  return <div className="space-y-6">
    <Card><CardHeader className="gap-4"><div><CardTitle>Find ledger entries</CardTitle><CardDescription>Filter the append-only history. Corrections are posted as new adjustments or reversals, never edits.</CardDescription></div>
      <form className="grid gap-3 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); apply(); }}>
        <Input aria-label="Member filter" value={draft.member} onChange={(event) => setDraft((current) => ({ ...current, member: event.target.value }))} placeholder="Member ID, name, email, phone" />
        <select aria-label="Direction filter" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={draft.direction} onChange={(event) => setDraft((current) => ({ ...current, direction: event.target.value }))}><option value="">All directions</option><option value="CREDIT">Credit</option><option value="DEBIT">Debit</option></select>
        <select aria-label="Transaction type filter" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}><option value="">All transaction types</option>{transactionTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
        <Input aria-label="Reference filter" value={draft.reference} onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))} placeholder="Reference type or ID" />
        <Input aria-label="Minimum amount" value={draft.minAmount} onChange={(event) => setDraft((current) => ({ ...current, minAmount: event.target.value }))} inputMode="decimal" placeholder="Minimum amount" />
        <Input aria-label="Maximum amount" value={draft.maxAmount} onChange={(event) => setDraft((current) => ({ ...current, maxAmount: event.target.value }))} inputMode="decimal" placeholder="Maximum amount" />
        <div className="lg:col-span-2"><DateRangeFilter value={{ from: draft.from, to: draft.to }} onChange={(range) => setDraft((current) => ({ ...current, ...range }))} /></div>
        <div className="flex flex-wrap gap-2 lg:col-span-4"><Button type="submit"><Search className="size-4" />Apply filters</Button><Button type="button" variant="outline" onClick={reset}>Clear</Button><Button asChild type="button" variant="outline"><a href={exportHref}><Download className="size-4" />Export CSV</a></Button></div>
      </form>
    </CardHeader></Card>
    <Card><CardHeader><CardTitle>Immutable wallet movements</CardTitle><CardDescription>{data.pagination.total.toLocaleString("en-IN")} matching entries. No financial ledger entry can be edited or deleted.</CardDescription></CardHeader><CardContent>
      {data.items.length ? <>
        <div className="grid gap-3 lg:hidden">{data.items.map((transaction) => <LedgerCard key={transaction.id} transaction={transaction} onView={openDetail} />)}</div>
        <div className="hidden overflow-x-auto lg:block"><Table><TableHeader><TableRow>{["Transaction ID", "Member", "Direction", "Type", "Amount", "Reference", "Description", "Balance snapshot", "Created at", ""].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map((transaction) => <TableRow key={transaction.id}><TableCell className="max-w-32 truncate font-mono text-xs" title={transaction.id}>{transaction.id}</TableCell><TableCell><p className="font-medium">{transaction.member?.name ?? "Unknown member"}</p><p className="text-xs text-muted-foreground">{transaction.member?.memberNumber ?? transaction.memberProfileId}</p></TableCell><TableCell><StatusBadge status={transaction.direction} /></TableCell><TableCell className="whitespace-nowrap text-sm">{transaction.type.replaceAll("_", " ")}</TableCell><TableCell className={transaction.direction === "CREDIT" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{transaction.direction === "CREDIT" ? "+" : "−"}{formatCurrency(transaction.amountMinor, transaction.currency)}</TableCell><TableCell className="max-w-40"><p className="truncate text-sm">{transaction.referenceType}</p><p className="truncate font-mono text-xs text-muted-foreground" title={transaction.referenceId}>{transaction.referenceId}</p></TableCell><TableCell className="max-w-52 truncate text-sm" title={transaction.description}>{transaction.description}</TableCell><TableCell className="whitespace-nowrap text-xs">Available {formatCurrency(transaction.resultingAvailableMinor, transaction.currency)}<br />Reserved {formatCurrency(transaction.resultingHeldMinor, transaction.currency)}</TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(transaction.createdAt)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => void openDetail(transaction.id)}><Eye className="size-4" />View</Button></TableCell></TableRow>)}</TableBody></Table></div>
        <Pagination className="mt-5" page={data.pagination.page} total={data.pagination.total} totalPages={data.pagination.totalPages} onPageChange={setPage} />
      </> : <EmptyState title="No wallet ledger entries found" description="Try clearing a filter or use a broader date range. Wallet movements will appear after an approved financial event is posted." />}
    </CardContent></Card>
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Wallet ledger transaction</DialogTitle><DialogDescription>This historical financial record is read-only. Any correction must be a new linked adjustment or reversal.</DialogDescription></DialogHeader>{detailLoading ? <Skeleton className="h-64" /> : detailError ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{detailError}</p> : detail ? <TransactionDetails transaction={detail} /> : null}<DialogFooter><Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function LedgerCard({ transaction, onView }: { transaction: Transaction; onView: (id: string) => void }) {
  return <article className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{transaction.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{transaction.member?.name ?? "Unknown member"} · {transaction.member?.memberNumber ?? transaction.memberProfileId}</p></div><StatusBadge status={transaction.direction} /></div><p className={transaction.direction === "CREDIT" ? "mt-3 text-lg font-bold text-emerald-700" : "mt-3 text-lg font-bold text-rose-700"}>{transaction.direction === "CREDIT" ? "+" : "−"}{formatCurrency(transaction.amountMinor, transaction.currency)}</p><p className="mt-1 truncate text-sm text-muted-foreground" title={transaction.description}>{transaction.description}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</span><Button size="sm" variant="outline" onClick={() => void onView(transaction.id)}><Eye className="size-4" />View</Button></div></article>;
}

function TransactionDetails({ transaction }: { transaction: Transaction }) {
  const fields: Array<[string, string]> = [["Transaction ID", transaction.id], ["Member", transaction.member ? `${transaction.member.name} · ${transaction.member.memberNumber}` : transaction.memberProfileId], ["Direction", transaction.direction], ["Type", transaction.type.replaceAll("_", " ")], ["Amount", formatCurrency(transaction.amountMinor, transaction.currency)], ["Reference", `${transaction.referenceType}: ${transaction.referenceId}`], ["Available balance snapshot", formatCurrency(transaction.resultingAvailableMinor, transaction.currency)], ["Reserved balance snapshot", formatCurrency(transaction.resultingHeldMinor, transaction.currency)], ["Created at", formatDateTime(transaction.createdAt)], ["Description", transaction.description]];
  return <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className={label === "Description" ? "sm:col-span-2" : ""}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl>;
}
