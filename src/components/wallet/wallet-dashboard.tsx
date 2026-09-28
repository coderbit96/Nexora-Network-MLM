"use client";

import { ChevronLeft, ChevronRight, Landmark, Search, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type Wallet = { currency: string; availableMinor: string; heldMinor: string; lifetimeCreditMinor: string; lifetimeDebitMinor: string; lifetimeEarningsMinor: string; lifetimeWithdrawalsMinor: string };
type Transaction = { id: string; type: string; direction: "CREDIT" | "DEBIT"; amountMinor: string; resultingAvailableMinor: string; description: string; createdAt: string };
type WalletData = { wallet: Wallet; transactions: Transaction[]; pagination: { total: number; page: number; limit: number; totalPages: number }; member?: { memberNumber: string; name: string; status: string } };
type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init); const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.success) throw new Error(!payload.success ? payload.error?.message ?? "Request failed." : "Request failed.");
  return payload.data;
}

function Summary({ wallet }: { wallet: Wallet }) {
  const entries = [
    ["Available balance", wallet.availableMinor, "Funds currently available to you"],
    ["Reserved balance", wallet.heldMinor, "Held for approved financial workflows"],
    ["Lifetime earnings", wallet.lifetimeEarningsMinor, "Direct and level commissions"],
    ["Lifetime withdrawals", wallet.lifetimeWithdrawalsMinor, "Completed withdrawal debits"],
  ];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{entries.map(([label, amount, note]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{formatCurrency(amount, wallet.currency)}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>)}</div>;
}

function TransactionHistory({ data, onChange }: { data: WalletData; onChange: (type: string, direction: string, page: number) => void }) {
  const [type, setType] = useState(""); const [direction, setDirection] = useState("");
  const update = (nextType: string, nextDirection: string, page = 1) => { setType(nextType); setDirection(nextDirection); onChange(nextType, nextDirection, page); };
  return <Card><CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle>Ledger history</CardTitle><CardDescription>Immutable wallet entries. Amounts and balance snapshots cannot be edited.</CardDescription></div><div className="grid grid-cols-2 gap-2"><select aria-label="Filter wallet transaction type" value={type} onChange={(event) => update(event.target.value, direction)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All types</option><option value="DIRECT_COMMISSION">Direct commission</option><option value="LEVEL_COMMISSION">Level commission</option><option value="WITHDRAWAL_RESERVATION">Withdrawal reservation</option><option value="WITHDRAWAL_RELEASE">Withdrawal release</option><option value="WITHDRAWAL">Withdrawal settlement</option><option value="ADMIN_CREDIT">Admin credit</option><option value="ADMIN_DEBIT">Admin debit</option></select><select aria-label="Filter wallet transaction direction" value={direction} onChange={(event) => update(type, event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All directions</option><option value="CREDIT">Credits</option><option value="DEBIT">Debits</option></select></div></CardHeader><CardContent>{data.transactions.length ? <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Direction</TableHead><TableHead>Amount</TableHead><TableHead>Balance after</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{data.transactions.map((entry) => <TableRow key={entry.id}><TableCell><p className="font-medium">{entry.type.replaceAll("_", " ")}</p><p className="max-w-xs truncate text-xs text-muted-foreground" title={entry.description}>{entry.description}</p></TableCell><TableCell><Badge variant={entry.direction === "CREDIT" ? "success" : "warning"}>{entry.direction}</Badge></TableCell><TableCell className={entry.direction === "CREDIT" ? "font-semibold text-emerald-700" : "font-semibold text-foreground"}>{entry.direction === "CREDIT" ? "+" : "−"}{formatCurrency(entry.amountMinor, data.wallet.currency)}</TableCell><TableCell>{formatCurrency(entry.resultingAvailableMinor, data.wallet.currency)}</TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell></TableRow>)}</TableBody></Table></div><div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>{data.pagination.total} entries</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={data.pagination.page <= 1} onClick={() => onChange(type, direction, data.pagination.page - 1)}><ChevronLeft className="size-4" />Previous</Button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><Button size="sm" variant="outline" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => onChange(type, direction, data.pagination.page + 1)}>Next<ChevronRight className="size-4" /></Button></div></div></> : <EmptyState title="No wallet entries yet" description="Commission credits and other wallet activity will appear here when posted." />}</CardContent></Card>;
}

function WalletContent({ endpoint, member, allowAdjustment }: { endpoint: string; member?: string; allowAdjustment?: boolean }) {
  const [data, setData] = useState<WalletData | null>(null); const [error, setError] = useState(false); const [loading, setLoading] = useState(true); const [adjusting, setAdjusting] = useState(false); const adjustmentInFlight = useRef(false);
  const load = useCallback(async (type = "", direction = "", page = 1) => { setLoading(true); setError(false); const query = new URLSearchParams({ page: String(page) }); if (type) query.set("type", type); if (direction) query.set("direction", direction); try { setData(await request<WalletData>(`${endpoint}?${query}`)); } catch { setError(true); } finally { setLoading(false); } }, [endpoint]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const adjust = async (form: HTMLFormElement) => {
    if (adjustmentInFlight.current) return;
    adjustmentInFlight.current = true; setAdjusting(true);
    const fields = new FormData(form); const amount = String(fields.get("amount") ?? ""); const reason = String(fields.get("reason") ?? ""); const direction = String(fields.get("direction") ?? "");
    const idempotencyKey = crypto.randomUUID();
    try { await request(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, reason, direction, idempotencyKey }) }); toast.success("Wallet adjustment posted to the immutable ledger."); form.reset(); await load(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not post wallet adjustment."); } finally { adjustmentInFlight.current = false; setAdjusting(false); }
  };
  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-32" /><Skeleton className="h-80" /></div>;
  if (error || !data) return <ErrorState title="Wallet data could not be loaded" description="Please refresh and try again." />;
  return <div className="space-y-6">{member && data.member ? <Card><CardContent className="flex items-center gap-3 p-5"><Landmark className="size-5 text-primary" /><div><p className="font-semibold">{data.member.name} <span className="font-normal text-muted-foreground">· {data.member.memberNumber}</span></p><p className="text-sm text-muted-foreground">Account status: {data.member.status}</p></div></CardContent></Card> : null}<Summary wallet={data.wallet} />{allowAdjustment ? <Card><CardHeader><CardTitle>Manual adjustment</CardTitle><CardDescription>Requires a reason and posts a non-editable ledger entry with an audit record.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-[160px_1fr_2fr_auto]" onSubmit={(event) => { event.preventDefault(); void adjust(event.currentTarget); }}><select name="direction" aria-label="Adjustment direction" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="CREDIT">Credit</option><option value="DEBIT">Debit</option></select><Input name="amount" inputMode="decimal" placeholder="Amount (e.g. 250.00)" required /><Input name="reason" placeholder="Reason (minimum 10 characters)" minLength={10} maxLength={500} required /><Button type="submit" disabled={adjusting}><WalletCards className="size-4" />{adjusting ? "Posting…" : "Post adjustment"}</Button></form></CardContent></Card> : null}<TransactionHistory data={data} onChange={(type, direction, page) => void load(type, direction, page)} /></div>;
}

export function MemberWalletPanel() { return <WalletContent endpoint="/api/v1/wallet/me" />; }

export function AdminWalletPanel() {
  const [memberNumber, setMemberNumber] = useState(""); const [selected, setSelected] = useState("");
  const normalized = useMemo(() => selected.trim().toUpperCase(), [selected]);
  return <div className="space-y-6"><Card><CardHeader><CardTitle>Inspect a member wallet</CardTitle><CardDescription>Look up a member by their immutable MLM member number.</CardDescription></CardHeader><CardContent><form className="flex max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); setSelected(memberNumber); }}><Input value={memberNumber} onChange={(event) => setMemberNumber(event.target.value)} placeholder="MLM000001" aria-label="Member number" required /><Button type="submit"><Search className="size-4" />Open wallet</Button></form></CardContent></Card>{normalized ? <WalletContent endpoint={`/api/v1/admin/wallets/${encodeURIComponent(normalized)}`} member={normalized} allowAdjustment /> : <EmptyState title="Select a member" description="Enter a member number to inspect their wallet and make an authorized adjustment." />}</div>;
}
