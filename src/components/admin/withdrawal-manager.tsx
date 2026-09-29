"use client";

import { CheckCircle2, CircleX, Eye, LoaderCircle, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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

type Status = "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "CANCELLED";
type AdministrativeStatus = "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED";
type Person = { name: string; email: string };
type Withdrawal = { id: string; member: { memberNumber: string; name: string } | null; amountMinor: string; currency: string; status: Status; requestedAt: string; updatedAt: string; destination: { paymentMethod: string; accountLast4: string }; reviewer: Person | null; paymentReference?: string; allowedTransitions: AdministrativeStatus[]; timeline: Array<{ status: Status; changedAt: string; actor: string | null; note?: string; paymentReference?: string }> };
type Detail = Withdrawal & { wallet: { currency: string; availableMinor: string; heldMinor: string; lifetimeEarningsMinor: string; lifetimeWithdrawalsMinor: string } | null };
type Payload = { withdrawals: Withdrawal[]; pagination: { total: number; page: number; limit: number; totalPages: number }; statusCounts: Partial<Record<Status, number>>; canExport: boolean };
type Api<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
const tabs: Array<{ label: string; status?: Status }> = [{ label: "All" }, { label: "Pending", status: "PENDING" }, { label: "Approved", status: "APPROVED" }, { label: "Processing", status: "PROCESSING" }, { label: "Completed", status: "COMPLETED" }, { label: "Rejected", status: "REJECTED" }];

async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  const payload = await response.json() as Api<T>;
  if (!response.ok || !payload.success) throw new Error(payload.success ? "The request could not be completed." : payload.error?.message ?? "The request could not be completed.");
  return payload.data;
}

function actionLabel(status: AdministrativeStatus) {
  return status === "APPROVED" ? "Approve" : status === "REJECTED" ? "Reject" : status === "PROCESSING" ? "Move to processing" : "Complete";
}

function ActionIcon({ status }: { status: AdministrativeStatus }) {
  return status === "APPROVED" ? <CheckCircle2 className="size-4" /> : status === "REJECTED" ? <CircleX className="size-4" /> : status === "PROCESSING" ? <Play className="size-4" /> : <CheckCircle2 className="size-4" />;
}

export function AdminWithdrawalManager() {
  const [status, setStatus] = useState<Status | undefined>("PENDING"); const [page, setPage] = useState(1); const [data, setData] = useState<Payload | null>(null); const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null); const [detailOpen, setDetailOpen] = useState(false); const [detailLoading, setDetailLoading] = useState(false); const [detailError, setDetailError] = useState<string | null>(null);
  const [action, setAction] = useState<{ withdrawal: Withdrawal; status: AdministrativeStatus } | null>(null); const [note, setNote] = useState(""); const [reference, setReference] = useState(""); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { setError(null); setData(await api<Payload>(`/api/v1/admin/withdrawals?${new URLSearchParams({ page: String(page), limit: "25", ...(status ? { status } : {}) })}`)); }
    catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "Withdrawals could not be loaded."); }
  }, [page, status]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const selectTab = (next?: Status) => { setStatus(next); setPage(1); };
  const openDetail = async (id: string) => {
    setDetailOpen(true); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await api<Detail>(`/api/v1/admin/withdrawals/${id}`)); }
    catch (cause) { setDetailError(cause instanceof Error ? cause.message : "Withdrawal details could not be loaded."); }
    finally { setDetailLoading(false); }
  };
  const openAction = (withdrawal: Withdrawal, next: AdministrativeStatus) => { setAction({ withdrawal, status: next }); setNote(""); setReference(""); };
  const transition = async () => {
    if (!action || saving) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/withdrawals/${action.withdrawal.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: action.status, ...(note.trim() ? { note: note.trim() } : {}), ...(reference.trim() ? { paymentReference: reference.trim() } : {}) }) });
      toast.success(`Withdrawal ${actionLabel(action.status).toLowerCase()}d.`);
      setAction(null); await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Withdrawal could not be updated."); }
    finally { setSaving(false); }
  };
  if (!data && !error) return <Skeleton className="h-[34rem]" />;
  if (error || !data) return <ErrorState title="Withdrawals could not be loaded" description={error ?? "Check your permissions and try again."} action={<Button onClick={() => void load()}>Try again</Button>} />;
  const allCount = Object.values(data.statusCounts).reduce((total, count) => total + (count ?? 0), 0);

  return <div className="space-y-6"><Card><CardHeader className="gap-4"><div><CardTitle>Withdrawal operations</CardTitle><CardDescription>Reserved funds are approved, processed, and completed through a controlled financial workflow. Rejections return held funds to the member wallet.</CardDescription></div><div className="flex flex-wrap gap-2" role="tablist" aria-label="Withdrawal status queues">{tabs.map((tab) => <Button key={tab.label} size="sm" role="tab" aria-selected={status === tab.status} variant={status === tab.status ? "default" : "outline"} onClick={() => selectTab(tab.status)}>{tab.label}<span className="rounded bg-background/20 px-1.5 py-0.5 text-xs">{tab.status ? data.statusCounts[tab.status] ?? 0 : allCount}</span></Button>)}</div></CardHeader></Card>
    <Card><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{status ? `${status[0]}${status.slice(1).toLowerCase()} withdrawals` : "All withdrawals"}</CardTitle><CardDescription>{data.pagination.total.toLocaleString("en-IN")} requests in this queue. Cancelled requests remain visible from the All queue for audit history.</CardDescription></div>{data.canExport ? <Button asChild variant="outline"><a href={`/api/v1/admin/withdrawals/export${status ? `?status=${status}` : ""}`}>Export CSV</a></Button> : null}</CardHeader><CardContent>{data.withdrawals.length ? <>
      <div className="grid gap-3 lg:hidden">{data.withdrawals.map((withdrawal) => <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} onDetail={openDetail} onAction={openAction} />)}</div>
      <div className="hidden overflow-x-auto lg:block"><Table><TableHeader><TableRow>{["Withdrawal ID", "Member", "Amount", "Payment method", "Requested at", "Status", "Reviewer", "Actions"].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{data.withdrawals.map((withdrawal) => <TableRow key={withdrawal.id}><TableCell className="max-w-28 truncate font-mono text-xs" title={withdrawal.id}>{withdrawal.id}</TableCell><TableCell><button className="text-left hover:text-primary" onClick={() => void openDetail(withdrawal.id)}><p className="font-medium">{withdrawal.member?.name ?? "Unknown member"}</p><p className="text-xs text-muted-foreground">{withdrawal.member?.memberNumber ?? "Unavailable"}</p></button></TableCell><TableCell className="font-semibold">{formatCurrency(withdrawal.amountMinor, withdrawal.currency)}</TableCell><TableCell><p className="text-sm">{withdrawal.destination.paymentMethod}</p><p className="text-xs text-muted-foreground">{withdrawal.destination.accountLast4}</p></TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(withdrawal.requestedAt)}</TableCell><TableCell><StatusBadge status={withdrawal.status} /></TableCell><TableCell className="max-w-36"><p className="truncate text-sm" title={withdrawal.reviewer?.email}>{withdrawal.reviewer?.name ?? "Not reviewed"}</p></TableCell><TableCell><div className="flex min-w-max justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void openDetail(withdrawal.id)}><Eye className="size-4" />View</Button>{withdrawal.allowedTransitions.map((next) => <Button key={next} size="sm" variant={next === "REJECTED" ? "destructive" : "outline"} onClick={() => openAction(withdrawal, next)}><ActionIcon status={next} />{actionLabel(next)}</Button>)}</div></TableCell></TableRow>)}</TableBody></Table></div>
      <Pagination className="mt-5" page={data.pagination.page} total={data.pagination.total} totalPages={data.pagination.totalPages} onPageChange={setPage} />
    </> : <EmptyState title="No withdrawals in this queue" description="Requests matching this status will appear here for review." />}</CardContent></Card>
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Withdrawal request</DialogTitle><DialogDescription>Payment destination details are intentionally masked. Use the approved payment workflow for settlement.</DialogDescription></DialogHeader>{detailLoading ? <Skeleton className="h-80" /> : detailError ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{detailError}</p> : detail ? <WithdrawalDetail detail={detail} /> : null}<DialogFooter><Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !saving) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{action ? `${actionLabel(action.status)} withdrawal?` : "Update withdrawal"}</DialogTitle><DialogDescription>{action?.status === "APPROVED" ? "Approval confirms the request still has an intact reserved wallet balance." : action?.status === "REJECTED" ? "A reason is required. The reserved amount will be released back to the member's available balance." : action?.status === "PROCESSING" ? "This records the acting administrator and moves the approved request into the payment workflow." : "Completion settles the reserved amount. Confirm the payment was sent and enter its reference."}</DialogDescription></DialogHeader>{action ? <label className="grid gap-2 text-sm font-medium">{action.status === "REJECTED" ? "Rejection reason" : "Admin note (optional)"}<Input value={note} minLength={action.status === "REJECTED" ? 3 : undefined} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder={action.status === "REJECTED" ? "Explain why this request is being rejected" : "Add a note to the status timeline"} autoFocus={action.status === "REJECTED"} /></label> : null}{action?.status === "COMPLETED" ? <label className="grid gap-2 text-sm font-medium">Payment reference<Input value={reference} maxLength={160} onChange={(event) => setReference(event.target.value)} placeholder="Bank transfer, UTR, or provider reference" autoFocus /></label> : null}<DialogFooter><Button variant="outline" disabled={saving} onClick={() => setAction(null)}>Cancel</Button><Button variant={action?.status === "REJECTED" ? "destructive" : "default"} disabled={saving || (action?.status === "REJECTED" && note.trim().length < 3) || (action?.status === "COMPLETED" && !reference.trim())} onClick={() => void transition()}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Saving</> : action ? actionLabel(action.status) : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function WithdrawalCard({ withdrawal, onDetail, onAction }: { withdrawal: Withdrawal; onDetail: (id: string) => void; onAction: (withdrawal: Withdrawal, status: AdministrativeStatus) => void }) {
  return <article className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><button className="min-w-0 text-left hover:text-primary" onClick={() => void onDetail(withdrawal.id)}><p className="truncate font-medium">{withdrawal.member?.name ?? "Unknown member"}</p><p className="text-xs text-muted-foreground">{withdrawal.member?.memberNumber ?? "Unavailable"}</p></button><StatusBadge status={withdrawal.status} /></div><p className="mt-3 text-xl font-bold">{formatCurrency(withdrawal.amountMinor, withdrawal.currency)}</p><p className="mt-1 text-sm text-muted-foreground">{withdrawal.destination.paymentMethod} · {withdrawal.destination.accountLast4}</p><p className="mt-1 text-xs text-muted-foreground">Requested {formatDateTime(withdrawal.requestedAt)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void onDetail(withdrawal.id)}><Eye className="size-4" />View</Button>{withdrawal.allowedTransitions.map((next) => <Button key={next} size="sm" variant={next === "REJECTED" ? "destructive" : "outline"} onClick={() => onAction(withdrawal, next)}><ActionIcon status={next} />{actionLabel(next)}</Button>)}</div></article>;
}

function WithdrawalDetail({ detail }: { detail: Detail }) {
  const overview: Array<[string, string]> = [["Member", detail.member ? `${detail.member.name} · ${detail.member.memberNumber}` : "Unknown member"], ["Amount", formatCurrency(detail.amountMinor, detail.currency)], ["Status", detail.status], ["Payment method", `${detail.destination.paymentMethod} · ${detail.destination.accountLast4}`], ["Requested", formatDateTime(detail.requestedAt)], ["Reviewer", detail.reviewer ? `${detail.reviewer.name} (${detail.reviewer.email})` : "Not reviewed"], ["Payment reference", detail.paymentReference ?? "Not recorded"]];
  return <div className="space-y-5"><dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">{overview.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl>{detail.wallet ? <div><p className="mb-2 text-sm font-semibold">Wallet summary</p><div className="grid gap-2 sm:grid-cols-2"><Metric label="Available" value={formatCurrency(detail.wallet.availableMinor, detail.wallet.currency)} /><Metric label="Reserved" value={formatCurrency(detail.wallet.heldMinor, detail.wallet.currency)} /><Metric label="Lifetime earnings" value={formatCurrency(detail.wallet.lifetimeEarningsMinor, detail.wallet.currency)} /><Metric label="Lifetime withdrawn" value={formatCurrency(detail.wallet.lifetimeWithdrawalsMinor, detail.wallet.currency)} /></div></div> : null}<div><p className="mb-2 text-sm font-semibold">Status timeline</p><ol className="space-y-3 border-l pl-4">{detail.timeline.map((entry, index) => <li key={`${entry.status}-${entry.changedAt}-${index}`} className="relative"><span className="absolute -left-[1.31rem] top-1.5 size-2 rounded-full bg-primary" /><p className="text-sm font-medium">{entry.status.replaceAll("_", " ")} <span className="font-normal text-muted-foreground">· {formatDateTime(entry.changedAt)}</span></p>{entry.actor ? <p className="text-xs text-muted-foreground">By {entry.actor}</p> : null}{entry.note ? <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p> : null}{entry.paymentReference ? <p className="mt-1 text-sm text-muted-foreground">Payment reference: {entry.paymentReference}</p> : null}</li>)}</ol></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
