"use client";

import { Check, Pencil, Plus, Power, Search, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSION_CATALOG, type PermissionKey, type PermissionMetadata } from "@/config/permissions";

type Role = { id: string; name: string; slug: string; description: string; baseRole: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "MEMBER"; permissions: PermissionKey[]; isSystem: boolean; isActive: boolean };
type RolePayload = { success: true; data: { items: Role[] } } | { success: false; error?: { message?: string } };
type Draft = Pick<Role, "name" | "slug" | "description" | "baseRole" | "permissions" | "isActive">;
const emptyDraft: Draft = { name: "", slug: "", description: "", baseRole: "STAFF", permissions: [], isActive: true };
const baseHelp: Record<Role["baseRole"], string> = {
  STAFF: "Recommended for delegated operational staff. Select their exact functions below.",
  ADMIN: "For elevated administrators. Select only the functions they genuinely need.",
  MEMBER: "For a member-facing workspace. It does not provide admin access by itself.",
  SUPER_ADMIN: "Unrestricted system access. Permissions cannot limit this role.",
};

function errorMessage(value: { error?: { message?: string } }) { return value.error?.message ?? "The role could not be saved. Please try again."; }
function slugFromName(name: string) { return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100); }

export function RoleManager({ canCreate, canEdit, canDelete, canManageSystemStatus }: { canCreate: boolean; canEdit: boolean; canDelete: boolean; canManageSystemStatus: boolean }) {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [changingStatus, setChangingStatus] = useState<Role | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const results = new Map<string, PermissionMetadata[]>();
    for (const item of PERMISSION_CATALOG) results.set(item.category, [...(results.get(item.category) ?? []), item]);
    return [...results.entries()];
  }, []);
  const visibleGroups = useMemo(() => {
    const term = permissionSearch.trim().toLowerCase();
    if (!term) return groups;
    return groups.map(([name, values]) => [name, values.filter((item) => (item.key + " " + item.label + " " + item.description).toLowerCase().includes(term))] as const).filter(([, values]) => values.length);
  }, [groups, permissionSearch]);
  const visibleKeys = useMemo(() => visibleGroups.flatMap(([, values]) => values.map((item) => item.key)), [visibleGroups]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/management/roles?limit=100", { cache: "no-store" });
      const body = await response.json() as RolePayload;
      if (!response.ok || !body.success) throw new Error(errorMessage(body as { error?: { message?: string } }));
      setRoles(body.data.items); setFailed(false);
    } catch (error) { setFailed(true); toast.error(error instanceof Error ? error.message : "Roles could not be loaded."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    if (dialogOpen) requestAnimationFrame(() => editorScrollRef.current?.scrollTo({ top: 0 }));
  }, [dialogOpen, editing?.id]);

  function openCreate() { setEditing(null); setDraft(emptyDraft); setPermissionSearch(""); setDialogOpen(true); }
  function openEdit(role: Role) { setEditing(role); setDraft({ name: role.name, slug: role.slug, description: role.description, baseRole: role.baseRole, permissions: role.permissions, isActive: role.isActive }); setPermissionSearch(""); setDialogOpen(true); }
  function changePermission(key: PermissionKey, enabled: boolean) { setDraft((value) => ({ ...value, permissions: enabled ? [...new Set([...value.permissions, key])] : value.permissions.filter((item) => item !== key) })); }
  function changeVisible(enabled: boolean) { setDraft((value) => ({ ...value, permissions: enabled ? [...new Set([...value.permissions, ...visibleKeys])] : value.permissions.filter((item) => !visibleKeys.includes(item)) })); }

  async function save() {
    if (!draft.name.trim() || !draft.slug.trim()) { toast.error("Enter both a role name and role slug."); return; }
    setSaving(true);
    try {
      const payload = editing?.isSystem ? { description: draft.description || null, permissions: draft.permissions } : { name: draft.name, slug: draft.slug, description: draft.description || undefined, baseRole: draft.baseRole, permissions: draft.permissions, ...(editing ? { isActive: draft.isActive } : {}) };
      const response = await fetch(editing ? "/api/v1/admin/roles/" + editing.id : "/api/v1/admin/roles", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !body.success) throw new Error(errorMessage(body));
      toast.success(editing ? "Role updated." : "Role created."); setDialogOpen(false); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The role could not be saved."); } finally { setSaving(false); }
  }
  async function remove() {
    if (!deleting) return; setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/roles/" + deleting.id, { method: "DELETE" });
      const body = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !body.success) throw new Error(errorMessage(body));
      toast.success("Role deleted."); setDeleting(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The role could not be deleted."); } finally { setSaving(false); }
  }
  async function updateStatus() {
    if (!changingStatus) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/roles/" + changingStatus.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !changingStatus.isActive }) });
      const body = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !body.success) throw new Error(errorMessage(body));
      toast.success(changingStatus.isActive ? "Role deactivated." : "Role activated.");
      setChangingStatus(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The role status could not be updated."); } finally { setSaving(false); }
  }

  if (!roles && !failed) return <Skeleton className="h-96" />;
  if (failed || !roles) return <ErrorState title="Roles could not be loaded" />;
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => draft.permissions.includes(key));
  const canChangeStatus = (role: Role) => canEdit && (!role.isSystem || (canManageSystemStatus && role.baseRole !== "SUPER_ADMIN"));

  return <>
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>Application roles</CardTitle><CardDescription>Create scoped roles, then select exactly which functions each role can use.</CardDescription></div>
        {canCreate ? <Button onClick={openCreate}><Plus className="size-4" />Create role</Button> : null}
      </CardHeader>
      <CardContent>
        {roles.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Workspace</TableHead><TableHead>Functions</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{roles.map((role) => <TableRow key={role.id}><TableCell><p className="font-medium">{role.name}</p><p className="text-xs text-muted-foreground">{role.slug}</p></TableCell><TableCell><Badge variant={role.isSystem ? "warning" : "secondary"}>{role.baseRole}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{role.baseRole === "SUPER_ADMIN" ? "Implicit unrestricted access" : role.permissions.length + " selected"}</TableCell><TableCell><Badge variant={role.isActive ? "success" : "secondary"}>{role.isActive ? "ACTIVE" : "INACTIVE"}</Badge></TableCell><TableCell><div className="flex justify-end gap-2">{canEdit ? <Button variant="outline" size="sm" onClick={() => openEdit(role)}><Pencil className="size-4" />Edit</Button> : null}{canChangeStatus(role) ? <Button variant="outline" size="sm" onClick={() => setChangingStatus(role)}><Power className="size-4" />{role.isActive ? "Deactivate" : "Activate"}</Button> : null}{canDelete && !role.isSystem ? <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(role)}><Trash2 className="size-4" />Delete</Button> : null}</div></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState title="No roles found" description="Create a custom role to delegate scoped administrative access." />}
      </CardContent>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
      <DialogContent
        className="!h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] max-w-5xl gap-0 !overflow-hidden p-0"
        style={{ height: "calc(100vh - 2rem)" }}
      >
        <DialogHeader className="relative z-10 shrink-0 border-b bg-background px-5 pb-4 pt-5 pr-14 sm:px-6 sm:pb-5 sm:pt-6">
          <DialogTitle>{editing ? "Edit " + editing.name : "Create a role"}</DialogTitle>
          <DialogDescription>{editing?.isSystem ? "This is a system role. Its identity is locked; changes affect every assigned user." : "Choose a workspace, then select only the functions this role genuinely needs."}</DialogDescription>
        </DialogHeader>
        <div ref={editorScrollRef} className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"><div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-medium" htmlFor="role-name">Role name</label><Input id="role-name" className="mt-2" value={draft.name} disabled={Boolean(editing?.isSystem)} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value, ...(!editing && !value.slug ? { slug: slugFromName(event.target.value) } : {}) }))} /></div><div><label className="text-sm font-medium" htmlFor="role-slug">Role slug</label><Input id="role-slug" className="mt-2" value={draft.slug} disabled={Boolean(editing)} onChange={(event) => setDraft((value) => ({ ...value, slug: slugFromName(event.target.value) }))} /><p className="mt-1 text-xs text-muted-foreground">Used internally; it cannot change after creation.</p></div></div>
          <div><label className="text-sm font-medium" htmlFor="role-description">What is this role for?</label><textarea id="role-description" value={draft.description} maxLength={500} placeholder="Example: Reviews pending withdrawals but cannot complete payments." onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} className="mt-2 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div><label className="text-sm font-medium" htmlFor="role-base">Workspace access</label><select id="role-base" value={draft.baseRole} disabled={Boolean(editing?.isSystem)} onChange={(event) => setDraft((value) => ({ ...value, baseRole: event.target.value as Draft["baseRole"] }))} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="STAFF">STAFF — delegated admin workspace (recommended)</option><option value="ADMIN">ADMIN — elevated admin workspace</option><option value="MEMBER">MEMBER — member workspace only</option>{editing?.isSystem ? <option value="SUPER_ADMIN">SUPER_ADMIN — unrestricted system role</option> : null}</select><p className="mt-1 text-xs text-muted-foreground">{baseHelp[draft.baseRole]}</p></div>{editing && !editing.isSystem ? <label className="mt-7 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((value) => ({ ...value, isActive: event.target.checked }))} />Active role</label> : null}</div>
          {draft.baseRole === "SUPER_ADMIN" ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"><ShieldAlert className="mr-2 inline size-4" />Super Admin access is implicit. Permission checkboxes cannot limit or expand this role.</div> : <fieldset><div className="flex flex-wrap items-start justify-between gap-3"><div><legend className="font-medium">Functions this role can use</legend><p className="mt-1 text-xs text-muted-foreground">Selected: {draft.permissions.length}. Sensitive functions should be granted only to trusted operators.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allVisibleSelected} onChange={(event) => changeVisible(event.target.checked)} />Select visible</label></div><div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} className="pl-9" placeholder="Search a function, e.g. approve withdrawal" aria-label="Search role permissions" /></div><div className="mt-3 max-h-[min(44dvh,32rem)] overflow-y-auto rounded-xl border p-3"><div className="grid gap-3 md:grid-cols-2">{visibleGroups.map(([category, permissions]) => <div className="rounded-lg border bg-muted/20 p-3" key={category}><p className="text-xs font-bold tracking-wide text-muted-foreground">{category}</p><div className="mt-2 space-y-3">{permissions.map((permission) => <label key={permission.key} className="flex cursor-pointer items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={draft.permissions.includes(permission.key)} onChange={(event) => changePermission(permission.key, event.target.checked)} /><span><span className="font-medium">{permission.label}</span>{permission.sensitive ? <Badge className="ml-2" variant="warning">Sensitive</Badge> : null}<code className="mt-0.5 block text-xs text-primary">{permission.key}</code><span className="mt-1 block text-xs leading-5 text-muted-foreground">{permission.description}</span></span></label>)}</div></div>)}{!visibleGroups.length ? <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No functions match this search.</p> : null}</div></div></fieldset>}
        </div></div>
        <DialogFooter className="relative z-10 shrink-0 border-t bg-background px-5 py-4 sm:px-6"><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : <><Check className="size-4" />Save role</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && !saving && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Delete role?</DialogTitle><DialogDescription>{deleting ? "Delete " + deleting.name + "? This cannot be undone. Roles still assigned to users cannot be deleted." : ""}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void remove()}>{saving ? "Deleting…" : "Delete role"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(changingStatus)} onOpenChange={(open) => !open && !saving && setChangingStatus(null)}><DialogContent><DialogHeader><DialogTitle>{changingStatus?.isActive ? "Deactivate role?" : "Activate role?"}</DialogTitle><DialogDescription>{changingStatus ? changingStatus.isActive ? "Deactivate " + changingStatus.name + "? Users assigned only this role will lose access until it is activated again." : "Activate " + changingStatus.name + "? Assigned users will be able to use its granted functions again." : ""}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setChangingStatus(null)}>Cancel</Button><Button variant={changingStatus?.isActive ? "destructive" : "default"} disabled={saving} onClick={() => void updateStatus()}>{saving ? "Updating…" : changingStatus?.isActive ? "Deactivate role" : "Activate role"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
