"use client";

import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

const REPORTS = {
  members: { label: "Members", description: "Member registration and activation activity.", statuses: ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"] },
  referrals: { label: "Referrals", description: "Direct sponsor relationships and upline depth.", statuses: [] },
  commissions: { label: "Commissions", description: "Immutable direct and level commission records.", statuses: ["PENDING", "APPROVED", "REVERSED", "VOID"] },
  "wallet-transactions": { label: "Wallet transactions", description: "Immutable credits, debits, and reservations.", statuses: ["DIRECT_COMMISSION", "LEVEL_COMMISSION", "WITHDRAWAL", "ADMIN_CREDIT", "ADMIN_DEBIT"] },
  withdrawals: { label: "Withdrawals", description: "Member withdrawal requests and settlement lifecycle.", statuses: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"] },
  sales: { label: "Sales", description: "Verified successful payment orders only.", statuses: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"] },
  orders: { label: "Orders", description: "Checkout, payment, fulfillment, and commission status.", statuses: ["PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] },
} as const;

type ReportName = keyof typeof REPORTS;
type Row = Record<string, string | number | null>;
type ReportData = { items: Row[]; pagination: { total: number; page: number; limit: number; totalPages: number } };
type Response = { success: true; data: ReportData } | { success: false; error?: { message?: string } };

function heading(value: string) { return value.replace(/([A-Z])/g, " $1").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function isMoney(column: string) { return column === "amountMinor" || column === "totalMinor"; }
function isDate(column: string) { return column.endsWith("At"); }
function isStatus(column: string) { return column === "status" || column.endsWith("Status") || column === "type" || column === "direction"; }
function statusTone(value: string) { return ["ACTIVE", "APPROVED", "COMPLETED", "SUCCESS", "CREDIT", "PAID", "DELIVERED"].includes(value) ? "success" : ["PENDING", "PROCESSING", "DEBIT"].includes(value) ? "warning" : "secondary"; }

export function ReportsDashboard({ allowedReports, canExport }: { allowedReports: ReportName[]; canExport: boolean }) {
  const [report, setReport] = useState<ReportName>(allowedReports[0] ?? "members"); const [data, setData] = useState<ReportData | null>(null); const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [member, setMember] = useState(""); const [status, setStatus] = useState("");
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "25", ...(from ? { from } : {}), ...(to ? { to } : {}), ...(member.trim() ? { member: member.trim().toUpperCase() } : {}), ...(status ? { status } : {}) }), [page, from, to, member, status]);
  const load = useCallback(async () => { if (!allowedReports.includes(report)) return; setData(null); setFailed(false); try { const response = await fetch(`/api/v1/admin/reports/${report}?${query}`, { cache: "no-store" }); const payload = await response.json() as Response; if (!response.ok || !payload.success) throw new Error(payload.success ? "" : payload.error?.message); setData(payload.data); } catch { setFailed(true); } }, [query, report, allowedReports]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const changeReport = (value: ReportName) => { setReport(value); setPage(1); setStatus(""); };
  const columns = data?.items.length ? Object.keys(data.items[0]) : [];
  const downloadUrl = `/api/v1/admin/reports/${report}/export?${query}`;
  if (!allowedReports.length) return <EmptyState title="No reports assigned" description="Ask your administrator to grant access to a report category." />;
  return <div className="space-y-6"><Card><CardHeader className="gap-4"><div><CardTitle>Report filters</CardTitle><CardDescription>All report totals and records are calculated on the server. CSV exports stream in bounded batches.</CardDescription></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><select aria-label="Report type" value={report} onChange={(event) => changeReport(event.target.value as ReportName)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">{Object.entries(REPORTS).filter(([key]) => allowedReports.includes(key as ReportName)).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><Input type="date" aria-label="Report start date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /><Input type="date" aria-label="Report end date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /><Input aria-label="Member ID filter" placeholder="Member ID, e.g. MLM000001" value={member} onChange={(event) => { setMember(event.target.value); setPage(1); }} /></div><div className="flex flex-wrap gap-2"><select aria-label="Report status filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All statuses</option>{REPORTS[report].statuses.map((value) => <option key={value} value={value}>{heading(value)}</option>)}</select>{canExport ? <Button asChild variant="outline"><a href={downloadUrl}><Download className="size-4" />Export CSV</a></Button> : null}<Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setMember(""); setStatus(""); setPage(1); }}>Clear filters</Button></div></CardHeader></Card>{!data && !failed ? <Skeleton className="h-96" /> : failed || !data ? <div className="space-y-3"><ErrorState title="Report could not be loaded" description="Check your filters and try again." /><Button onClick={() => void load()}>Try again</Button></div> : <Card><CardHeader><CardTitle>{REPORTS[report].label}</CardTitle><CardDescription>{REPORTS[report].description}</CardDescription></CardHeader><CardContent>{data.items.length ? <><div className="overflow-x-auto"><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{heading(column)}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map((row, index) => <TableRow key={`${report}-${index}`}>{columns.map((column) => { const value = row[column]; return <TableCell key={column}>{isMoney(column) ? <span className="font-semibold">{formatCurrency(String(value ?? 0), String(row.currency ?? "INR"))}</span> : isDate(column) && value ? <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(String(value))}</span> : isStatus(column) && value ? <Badge variant={statusTone(String(value))}>{heading(String(value))}</Badge> : <span className="whitespace-nowrap text-sm">{value ?? "—"}</span>}</TableCell>; })}</TableRow>)}</TableBody></Table></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{data.pagination.total.toLocaleString("en-IN")} records</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" />Previous</Button><span>Page {page} of {data.pagination.totalPages}</span><Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next<ChevronRight className="size-4" /></Button></div></div></> : <EmptyState title="No report records found" description="Try widening the date range or clearing one of the filters." />}</CardContent></Card>}</div>;
}
