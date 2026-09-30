"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type OrderStatus = "PENDING" | "PAYMENT_PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
type AdministrativeStatus = "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
type Order = { id: string; orderNumber: string; currency: string; status: OrderStatus; paymentStatus: string; totalMinor: string; createdAt: string; member?: { memberNumber: string; name: string } | null };
type Page = { orders: Order[]; pagination: { total: number; page: number; limit: number; totalPages: number } };
type Envelope<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

const statuses: OrderStatus[] = ["PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  const payload = await response.json() as Envelope<T>;
  if (!response.ok || !payload.success) throw new Error(payload.success ? "The request could not be completed." : payload.error?.message ?? "The request could not be completed.");
  return payload.data;
}

function nextStatuses(status: OrderStatus): AdministrativeStatus[] {
  if (status === "PAYMENT_PENDING") return ["CANCELLED"];
  if (status === "PAID") return ["PROCESSING"];
  if (status === "PROCESSING") return ["SHIPPED"];
  if (status === "SHIPPED") return ["DELIVERED"];
  if (status === "DELIVERED") return ["REFUNDED"];
  return [];
}

function OrderActions({ order, onChoose }: { order: Order; onChoose: (status: AdministrativeStatus) => void }) {
  return <div className="flex flex-wrap justify-end gap-2">{nextStatuses(order.status).map((next) => <Button key={next} size="sm" variant={next === "CANCELLED" ? "destructive" : "outline"} onClick={() => onChoose(next)}>{next.replaceAll("_", " ")}</Button>)}</div>;
}

function OrderCard({ order, onChoose }: { order: Order; onChoose: (status: AdministrativeStatus) => void }) {
  return <article className="rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{order.orderNumber}</p><p className="mt-1 truncate text-sm text-muted-foreground">{order.member?.name ?? "Unknown member"}</p><p className="text-xs text-muted-foreground">{order.member?.memberNumber ?? "Member unavailable"}</p></div><StatusBadge status={order.status} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Total</dt><dd className="mt-1 font-semibold">{formatCurrency(order.totalMinor, order.currency)}</dd></div><div><dt className="text-xs text-muted-foreground">Payment</dt><dd className="mt-1"><StatusBadge status={order.paymentStatus} /></dd></div><div className="col-span-2"><dt className="text-xs text-muted-foreground">Placed</dt><dd className="mt-1 text-muted-foreground">{formatDateTime(order.createdAt)}</dd></div></dl><div className="mt-4 border-t pt-4"><OrderActions order={order} onChoose={onChoose} /></div></article>;
}

export function AdminOrdersManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const member = searchParams.get("member")?.trim() ?? "";
  const orderId = searchParams.get("order")?.trim() ?? "";
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ order: Order; status: AdministrativeStatus } | null>(null);
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "25", ...(status ? { status } : {}), ...(member ? { member } : {}), ...(orderId ? { order: orderId } : {}) }).toString(), [member, orderId, page, status]);
  const load = useCallback(async () => {
    try { setError(null); setData(await api<Page>(`/api/v1/admin/orders?${query}`)); }
    catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "Orders could not be loaded."); }
  }, [query]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const applyStatus = (next: string) => { setStatus(next); setPage(1); };
  const transition = async () => {
    if (!target || saving) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/orders/${target.order.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target.status }) });
      toast.success(`Order marked ${target.status.toLowerCase()}.`);
      setTarget(null);
      await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Order could not be updated."); }
    finally { setSaving(false); }
  };

  if (!data && !error) return <Skeleton className="h-[32rem]" />;
  if (error || !data) return <ErrorState title="Orders could not be loaded" description={error ?? "Check your permissions and try again."} action={<Button onClick={() => void load()}>Try again</Button>} />;

  const appliedFilter = member ? `Member: ${member}` : orderId ? `Order: ${orderId}` : null;
  return <div className="space-y-6"><Card><CardHeader className="gap-4"><div><CardTitle>Order operations</CardTitle><CardDescription>Payment capture is intentionally absent here; only verified provider events can mark an order paid.</CardDescription></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="text-sm font-medium">Status<select value={status} onChange={(event) => applyStatus(event.target.value)} className="ml-2 h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{appliedFilter ? <div className="flex items-center gap-2"><span className="max-w-56 truncate text-sm text-muted-foreground" title={appliedFilter}>{appliedFilter}</span><Button size="sm" variant="outline" onClick={() => router.push("/admin/orders")}>Clear filter</Button></div> : null}</div></CardHeader></Card>
    <Card><CardHeader><CardTitle>{appliedFilter ? "Filtered orders" : "All orders"}</CardTitle><CardDescription>{data.pagination.total.toLocaleString("en-IN")} orders match the current criteria.</CardDescription></CardHeader><CardContent>{data.orders.length ? <><div className="grid gap-3 lg:hidden">{data.orders.map((order) => <OrderCard key={order.id} order={order} onChoose={(next) => setTarget({ order, status: next })} />)}</div><div className="hidden lg:block"><Table aria-label="Orders"><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Member</TableHead><TableHead>Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{data.orders.map((order) => <TableRow key={order.id}><TableCell><p className="font-medium">{order.orderNumber}</p><p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p></TableCell><TableCell><p>{order.member?.name ?? "Unknown member"}</p><p className="text-xs text-muted-foreground">{order.member?.memberNumber ?? "Unavailable"}</p></TableCell><TableCell className="font-semibold">{formatCurrency(order.totalMinor, order.currency)}</TableCell><TableCell><StatusBadge status={order.paymentStatus} /></TableCell><TableCell><StatusBadge status={order.status} /></TableCell><TableCell><OrderActions order={order} onChoose={(next) => setTarget({ order, status: next })} /></TableCell></TableRow>)}</TableBody></Table></div><Pagination className="mt-5" page={data.pagination.page} total={data.pagination.total} totalPages={data.pagination.totalPages} onPageChange={setPage} /></> : <EmptyState title="No orders found" description={appliedFilter ? "Try clearing the selected member or order filter." : "Orders will appear after members complete checkout."} action={appliedFilter ? <Button variant="outline" onClick={() => router.push("/admin/orders")}>Clear filter</Button> : undefined} />}</CardContent></Card>
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !saving) setTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Mark {target?.order.orderNumber} {target?.status.toLowerCase()}?</DialogTitle><DialogDescription>{target?.status === "CANCELLED" ? "This cancels the unpaid order and restores its reserved stock." : "This fulfillment change is recorded in the audit log."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>Cancel</Button><Button disabled={saving} variant={target?.status === "CANCELLED" ? "destructive" : "default"} onClick={() => void transition()}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Saving</> : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
