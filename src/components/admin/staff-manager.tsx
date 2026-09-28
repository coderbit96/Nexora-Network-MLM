"use client";

import { Check, ChevronLeft, ChevronRight, Pencil, Search, ShieldAlert, UserRoundPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils/format";

type Status = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";
type Role = { id: string; name: string; slug: string; baseRole: "SUPER_ADMIN" | "ADMIN" | "STAFF" };
type Staff = { id: string; name: string; email: string; status: Status; roles: Role[]; createdAt: string; canManage: boolean };
type Capabilities = { canCreate: boolean; canEdit: boolean; canDisable: boolean; canAssignRoles: boolean };
type Data = { items: Staff[]; pagination: { total: number; page: number; limit: number; totalPages: number }; capabilities: Capabilities; assignableRoles: Role[] };
type Api<T> = { success: true; data: T } | { success: false; error?: { message?: string } };
type Draft = { name: string; email: string; roleId: string; status: Status };

const emptyDraft: Draft = { name: "", email: "", roleId: "", status: "PENDING" };
const statuses: Status[] = ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"];

function responseMessage(response: Api<unknown>) {
  return !response.success ? response.error?.message ?? "Request failed." : "Request failed.";
}

function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={status === "ACTIVE" ? "success" : status === "PENDING" ? "warning" : status === "DISABLED" ? "destructive" : "secondary"}>{status}</Badge>;
}

export function StaffManager() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [disableConfirmed, setDisableConfirmed] = useState(false);

  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "20", ...(querySearch ? { q: querySearch } : {}), ...(statusFilter ? { status: statusFilter } : {}) }).toString(), [page, querySearch, statusFilter]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/staff?${query}`, { cache: "no-store" });
      const payload = await response.json() as Api<Data>;
      if (!response.ok || !payload.success) throw new Error(responseMessage(payload));
      setData(payload.data);
      setFailed(false);
    } catch (error) {
      setFailed(true);
      toast.error(error instanceof Error ? error.message : "Staff could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function openCreate() {
    const firstRole = data?.assignableRoles[0];
    setEditing(null);
    setDraft({ ...emptyDraft, roleId: firstRole?.id ?? "" });
    setDisableConfirmed(false);
    setDialogOpen(true);
  }

  function openEdit(staff: Staff) {
    setEditing(staff);
    setDraft({ name: staff.name, email: staff.email, roleId: staff.roles[0]?.id ?? "", status: staff.status });
    setDisableConfirmed(false);
    setDialogOpen(true);
  }

  function permittedStatusOptions() {
    if (!data) return statuses;
    if (!editing) return statuses;
    const allowed: Status[] = data.capabilities.canEdit ? ["PENDING", "ACTIVE", "SUSPENDED"] : [];
    if (data.capabilities.canDisable || editing.status === "DISABLED") allowed.push("DISABLED");
    return [...new Set(allowed)];
  }

  async function save() {
    if (!data) return;
    if (draft.status === "DISABLED" && !disableConfirmed) {
      toast.error("Confirm the account disablement before continuing.");
      return;
    }
    const payload = editing
      ? {
          ...(data.capabilities.canEdit && draft.name !== editing.name ? { name: draft.name } : {}),
          ...(data.capabilities.canEdit && data.capabilities.canAssignRoles && draft.roleId !== editing.roles[0]?.id ? { roleId: draft.roleId } : {}),
          ...(draft.status !== editing.status ? { status: draft.status } : {}),
        }
      : { name: draft.name, email: draft.email, roleId: draft.roleId, status: draft.status };
    if (editing && !Object.keys(payload).length) {
      setDialogOpen(false);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/v1/admin/staff/${editing.id}` : "/api/v1/admin/staff", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as Api<unknown>;
      if (!response.ok || !result.success) throw new Error(responseMessage(result));
      toast.success(editing ? "Staff account updated." : "Staff account created. The user can set a password through Forgot password.");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The staff account could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-96" />;
  if (failed || !data) return <ErrorState title="Staff accounts could not be loaded" description="Refresh the page to try again." />;

  const mayMutate = data.capabilities.canEdit || data.capabilities.canDisable || (data.capabilities.canEdit && data.capabilities.canAssignRoles);
  const statusOptions = permittedStatusOptions();
  return <>
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>Staff accounts</CardTitle><CardDescription>Assign only bounded, database-backed roles. Staff set their own password through the standard reset flow.</CardDescription></div>
        {data.capabilities.canCreate && data.assignableRoles.length ? <Button onClick={openCreate}><UserRoundPlus className="size-4" />Add staff</Button> : null}
      </CardHeader>
      <CardContent>
        <form className="mb-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuerySearch(search.trim()); }}>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" aria-label="Search staff" />
          <Button type="submit" variant="outline"><Search className="size-4" />Search</Button>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as Status | ""); setPage(1); }} aria-label="Filter staff status" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </form>
        {data.items.length ? <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Account</TableHead><TableHead>Created</TableHead>{mayMutate ? <TableHead className="text-right">Actions</TableHead> : null}</TableRow></TableHeader><TableBody>
          {data.items.map((staff) => <TableRow key={staff.id}><TableCell><p className="font-medium">{staff.name}</p><p className="text-xs text-muted-foreground">{staff.email}</p></TableCell><TableCell>{staff.roles.map((role) => <Badge key={role.id} variant={role.baseRole === "SUPER_ADMIN" ? "warning" : "secondary"} className="mr-1">{role.name}</Badge>)}</TableCell><TableCell><StatusBadge status={staff.status} /></TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(staff.createdAt)}</TableCell>{mayMutate ? <TableCell className="text-right">{staff.canManage ? <Button size="sm" variant="outline" onClick={() => openEdit(staff)}><Pencil className="size-4" />Edit</Button> : <span className="text-xs text-muted-foreground">Protected</span>}</TableCell> : null}</TableRow>)}
        </TableBody></Table></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{data.pagination.total} staff accounts</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-4" />Previous</Button><span>Page {data.pagination.page} of {data.pagination.totalPages}</span><Button size="sm" variant="outline" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="size-4" /></Button></div></div></> : <EmptyState title="No staff accounts found" description="Create a staff account when you need to delegate a limited operational role." />}
      </CardContent>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}><DialogContent><DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : "Add staff account"}</DialogTitle><DialogDescription>{editing ? "Role and account-state changes are audited. You cannot edit your own staff account here." : "A Firebase identity is created without an administrator-controlled password. The person can use Forgot password to establish their sign-in password."}</DialogDescription></DialogHeader>
      <div className="grid gap-4"><div><label className="text-sm font-medium" htmlFor="staff-name">Name</label><Input id="staff-name" className="mt-2" value={draft.name} disabled={Boolean(editing && !data.capabilities.canEdit)} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></div>
      {!editing ? <div><label className="text-sm font-medium" htmlFor="staff-email">Email</label><Input id="staff-email" className="mt-2" type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></div> : <div><p className="text-sm font-medium">Email</p><p className="mt-2 text-sm text-muted-foreground">{draft.email}</p></div>}
      <div><label className="text-sm font-medium" htmlFor="staff-role">Role</label>{data.capabilities.canAssignRoles && (!editing || data.capabilities.canEdit) ? <select id="staff-role" value={draft.roleId} onChange={(event) => setDraft((current) => ({ ...current, roleId: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{data.assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name} · {role.baseRole}</option>)}</select> : <p className="mt-2 text-sm text-muted-foreground">{editing?.roles.map((role) => role.name).join(", ") ?? "No assignable role"}</p>}</div>
      <div><label className="text-sm font-medium" htmlFor="staff-status">Account status</label><select id="staff-status" value={draft.status} disabled={Boolean(editing && !data.capabilities.canEdit && !data.capabilities.canDisable)} onChange={(event) => { setDraft((current) => ({ ...current, status: event.target.value as Status })); setDisableConfirmed(false); }} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      {draft.status === "DISABLED" ? <label className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><input className="mt-1" type="checkbox" checked={disableConfirmed} onChange={(event) => setDisableConfirmed(event.target.checked)} /><span><ShieldAlert className="mr-1 inline size-4 text-destructive" />I understand this blocks application access and disables Firebase sign-in for this account.</span></label> : null}</div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={saving || (!editing && (!draft.name.trim() || !draft.email.trim() || !draft.roleId))} onClick={() => void save()}>{saving ? "Saving…" : <><Check className="size-4" />Save staff</>}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
