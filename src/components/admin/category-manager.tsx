"use client";

import { CheckCircle2, Pencil, Plus, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/format";

type Status = "ACTIVE" | "INACTIVE";
type Category = { id: string; name: string; slug: string; description: string; status: Status; productCount: number; createdAt: string; updatedAt: string };
type Form = { name: string; slug: string; description: string; status: Status };
type Data = { categories: Category[]; pagination: { total: number; page: number; limit: number; totalPages: number }; capabilities: { manage: boolean } };
type Api<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
const blank = (): Form => ({ name: "", slug: "", description: "", status: "ACTIVE" });

async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  const payload = await response.json() as Api<T>;
  if (!response.ok || !payload.success) throw new Error(payload.success ? "The request could not be completed." : payload.error?.message ?? "The request could not be completed.");
  return payload.data;
}

export function AdminCategoryManager() {
  const [search, setSearch] = useState(""); const [querySearch, setQuerySearch] = useState(""); const [status, setStatus] = useState<Status | "">(""); const [page, setPage] = useState(1); const [data, setData] = useState<Data | null>(null); const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | "create" | null>(null); const [form, setForm] = useState<Form>(blank); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState<string | null>(null); const [statusTarget, setStatusTarget] = useState<Category | null>(null);
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "25", ...(querySearch ? { q: querySearch } : {}), ...(status ? { status } : {}) }).toString(), [page, querySearch, status]);
  const load = useCallback(async () => { try { setError(null); setData(await api<Data>(`/api/v1/admin/categories?${query}`)); } catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "Categories could not be loaded."); } }, [query]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const openCreate = () => { setForm(blank()); setFormError(null); setEditing("create"); };
  const openEdit = (category: Category) => { setForm({ name: category.name, slug: category.slug, description: category.description, status: category.status }); setFormError(null); setEditing(category); };
  const save = async () => {
    if (!editing || saving) return; setSaving(true); setFormError(null);
    try { await api(editing === "create" ? "/api/v1/admin/categories" : `/api/v1/admin/categories/${editing.id}`, { method: editing === "create" ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); toast.success(editing === "create" ? "Category created." : "Category updated."); setEditing(null); await load(); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : "Category could not be saved."); }
    finally { setSaving(false); }
  };
  const changeStatus = async () => {
    if (!statusTarget || saving) return; setSaving(true);
    try { const next = statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"; await api(`/api/v1/admin/categories/${statusTarget.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) }); toast.success(`${statusTarget.name} is now ${next.toLowerCase()}.`); setStatusTarget(null); await load(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Category status could not be updated."); }
    finally { setSaving(false); }
  };
  if (!data && !error) return <Skeleton className="h-[32rem]" />;
  if (error || !data) return <ErrorState title="Categories could not be loaded" description={error ?? "Check your category permissions and try again."} action={<Button onClick={() => void load()}>Try again</Button>} />;
  const applySearch = () => { setQuerySearch(search.trim()); setPage(1); };
  return <div className="space-y-6"><Card><CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Category catalogue</CardTitle><CardDescription>Categories organize storefront navigation. Deactivating a category removes its active products from public catalogue browsing without deleting them.</CardDescription></div>{data.capabilities.manage ? <Button onClick={openCreate}><Plus className="size-4" />Create category</Button> : null}</CardHeader><CardContent><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); applySearch(); }}><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search categories" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, slug, or description" /></div><select aria-label="Category status filter" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as Status | ""); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><Button type="submit" variant="outline">Search</Button>{(querySearch || status) ? <Button type="button" variant="ghost" onClick={() => { setSearch(""); setQuerySearch(""); setStatus(""); setPage(1); }}>Clear</Button> : null}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Categories</CardTitle><CardDescription>{data.pagination.total.toLocaleString("en-IN")} configured categories</CardDescription></CardHeader><CardContent>{data.categories.length ? <><div className="grid gap-3 md:hidden">{data.categories.map((category) => <CategoryCard key={category.id} category={category} manageable={data.capabilities.manage} onEdit={openEdit} onStatus={setStatusTarget} />)}</div><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow>{["Category", "Description", "Products", "Status", "Updated", "Actions"].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{data.categories.map((category) => <TableRow key={category.id}><TableCell><p className="font-medium">{category.name}</p><p className="font-mono text-xs text-muted-foreground">/{category.slug}</p></TableCell><TableCell className="max-w-96"><p className="line-clamp-2 text-sm text-muted-foreground">{category.description || "No description"}</p></TableCell><TableCell>{category.productCount}</TableCell><TableCell><StatusBadge status={category.status} /></TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(category.updatedAt)}</TableCell><TableCell>{data.capabilities.manage ? <div className="flex min-w-max gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(category)}><Pencil className="size-4" />Edit</Button><Button size="sm" variant="outline" onClick={() => setStatusTarget(category)}>{category.status === "ACTIVE" ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}{category.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button></div> : <span className="text-sm text-muted-foreground">View only</span>}</TableCell></TableRow>)}</TableBody></Table></div><Pagination className="mt-5" page={data.pagination.page} total={data.pagination.total} totalPages={data.pagination.totalPages} onPageChange={setPage} /></> : <EmptyState title="No categories found" description="Try a different search or create the first category." action={data.capabilities.manage ? <Button onClick={openCreate}>Create category</Button> : undefined} />}</CardContent></Card>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editing === "create" ? "Create category" : "Edit category"}</DialogTitle><DialogDescription>Use a unique URL slug. Image and sort-order fields are not shown because this application has no category media or ordering storage configured.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-2 text-sm font-medium">Name<Input value={form.name} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Wellness" autoFocus /></label><label className="grid gap-2 text-sm font-medium">Slug<Input value={form.slug} maxLength={180} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="wellness" /></label><label className="grid gap-2 text-sm font-medium">Description<Textarea value={form.description} maxLength={2000} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional category description" /></label><label className="grid gap-2 text-sm font-medium">Status<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Status }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>{formError ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</p> : null}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={saving || form.name.trim().length < 2 || !form.slug.trim()} onClick={() => void save()}>{saving ? "Saving…" : <><CheckCircle2 className="size-4" />Save category</>}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open && !saving) setStatusTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{statusTarget?.status === "ACTIVE" ? "Deactivate category?" : "Activate category?"}</DialogTitle><DialogDescription>{statusTarget?.status === "ACTIVE" ? `${statusTarget.productCount} product${statusTarget.productCount === 1 ? "" : "s"} currently reference this category. Their public visibility will be affected, but no products or category history will be deleted.` : "This category can again support active products and public catalogue browsing."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setStatusTarget(null)}>Cancel</Button><Button disabled={saving} variant={statusTarget?.status === "ACTIVE" ? "destructive" : "default"} onClick={() => void changeStatus()}>{statusTarget?.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function CategoryCard({ category, manageable, onEdit, onStatus }: { category: Category; manageable: boolean; onEdit: (category: Category) => void; onStatus: (category: Category) => void }) {
  return <article className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{category.name}</p><p className="font-mono text-xs text-muted-foreground">/{category.slug}</p></div><StatusBadge status={category.status} /></div><p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{category.description || "No description"}</p><p className="mt-3 text-xs text-muted-foreground">{category.productCount} linked product{category.productCount === 1 ? "" : "s"} · Updated {formatDate(category.updatedAt)}</p>{manageable ? <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(category)}><Pencil className="size-4" />Edit</Button><Button size="sm" variant="outline" onClick={() => onStatus(category)}>{category.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button></div> : null}</article>;
}
