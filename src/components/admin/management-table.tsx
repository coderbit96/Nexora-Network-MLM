"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type Item = Record<string, unknown>;
type Response = { success: true; data: { items: Item[]; pagination: { total: number; page: number; limit: number; totalPages: number } } } | { success: false; error?: { message?: string } };
export type AdminColumn = { key: string; label: string; type?: "money" | "date" | "badge" | "list"; href?: "member-detail" };
export function ManagementTable({ resource, title, description, columns, statuses = [], searchPlaceholder = "Search records" }: { resource: string; title: string; description: string; columns: AdminColumn[]; statuses?: string[]; searchPlaceholder?: string }) {
  const [items, setItems] = useState<Item[] | null>(null); const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 }); const [search, setSearch] = useState(""); const [querySearch, setQuerySearch] = useState(""); const [status, setStatus] = useState(""); const [sort, setSort] = useState("newest"); const [failed, setFailed] = useState(false);
  const query = useMemo(() => new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit), sort, ...(querySearch ? { q: querySearch } : {}), ...(status ? { status } : {}) }).toString(), [pagination.page, pagination.limit, sort, querySearch, status]);
  const load = useCallback(async () => { try { const response = await fetch(`/api/v1/admin/management/${resource}?${query}`, { cache: "no-store" }); const payload = await response.json() as Response; if (!response.ok || !payload.success) throw new Error(); setItems(payload.data.items); setPagination(payload.data.pagination); setFailed(false); } catch { setFailed(true); } }, [query, resource]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const render = (item: Item, column: AdminColumn) => { const value = item[column.key]; if (column.type === "money") return <span className="font-semibold">{formatCurrency(String(value ?? 0), String(item.currency ?? "INR"))}</span>; if (column.type === "date") return value ? <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(String(value))}</span> : "—"; if (column.type === "badge") return <StatusBadge status={String(value)} />; if (column.type === "list") return <span className="text-sm">{Array.isArray(value) ? value.join(", ") || "—" : "—"}</span>; const text = value == null ? "—" : String(value); const href = column.href === "member-detail" ? `/admin/members/${String(item.id)}` : undefined; return href ? <Link className="font-medium text-primary hover:underline" href={href}>{text}</Link> : <span className="max-w-56 truncate text-sm" title={text}>{text}</span>; };
  if (!items && !failed) return <Skeleton className="h-96" />;
  if (failed || !items) return <ErrorState title={`${title} could not be loaded`} />;
  return <Card><CardHeader className="gap-4"><div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setPagination((current) => ({ ...current, page: 1 })); setQuerySearch(search.trim()); }}><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /><Button type="submit" variant="outline"><Search className="size-4" />Search</Button>{statuses.length ? <select value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} aria-label="Status filter" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select> : null}<Button type="button" variant="outline" onClick={() => { setSort((current) => current === "newest" ? "oldest" : "newest"); setPagination((current) => ({ ...current, page: 1 })); }}><SlidersHorizontal className="size-4" />{sort === "newest" ? "Newest" : "Oldest"}</Button></form></CardHeader><CardContent>{items.length ? <><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={String(item.id)}>{columns.map((column) => <TableCell key={column.key}>{render(item, column)}</TableCell>)}</TableRow>)}</TableBody></Table><Pagination className="mt-4" total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} /></> : <EmptyState title={`No ${title.toLowerCase()} found`} description="Try changing the search or filter criteria." />}</CardContent></Card>;
}
