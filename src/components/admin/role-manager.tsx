"use client";

import { Check, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
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
import { PERMISSION_CATALOG, type PermissionKey, type PermissionMetadata } from "@/config/permissions";

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseRole: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "MEMBER";
  permissions: PermissionKey[];
  isSystem: boolean;
  isActive: boolean;
};

type RolePayload = { success: true; data: { items: Role[] } } | { success: false; error?: { message?: string } };
type Draft = Pick<Role, "name" | "slug" | "description" | "baseRole" | "permissions" | "isActive">;
const emptyDraft: Draft = { name: "", slug: "", description: "", baseRole: "STAFF", permissions: [], isActive: true };

function messageFrom(response: { error?: { message?: string } }) {
  return response.error?.message ?? "The role could not be saved. Please try again.";
}

function slugFromName(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export function RoleManager({ canCreate, canEdit, canDelete }: { canCreate: boolean; canEdit: boolean; canDelete: boolean }) {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [editing, setEditing] = useState<Role | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionMetadata[]>();
    for (const permission of PERMISSION_CATALOG) groups.set(permission.category, [...(groups.get(permission.category) ?? []), permission]);
    return [...groups.entries()];
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/management/roles?limit=100", { cache: "no-store" });
      const payload = await response.json() as RolePayload;
      if (!response.ok || !payload.success) throw new Error(messageFrom(payload as { error?: { message?: string } }));
      setRoles(payload.data.items);
      setFailed(false);
    } catch (error) {
      setFailed(true);
      toast.error(error instanceof Error ? error.message : "Roles could not be loaded.");
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setDraft({ name: role.name, slug: role.slug, description: role.description, baseRole: role.baseRole, permissions: role.permissions, isActive: role.isActive });
    setDialogOpen(true);
  }

  function updatePermission(key: PermissionKey, checked: boolean) {
    setDraft((current) => ({ ...current, permissions: checked ? [...new Set([...current.permissions, key])] : current.permissions.filter((permission) => permission !== key) }));
  }

  async function save() {
    if (!draft.name.trim() || !draft.slug.trim()) {
      toast.error("Enter both a role name and role slug.");
      return;
    }
    setSaving(true);
    try {
      const isSystem = editing?.isSystem ?? false;
      const payload = isSystem
        ? { description: draft.description || null, permissions: draft.permissions }
        : { name: draft.name, slug: draft.slug, description: draft.description || undefined, baseRole: draft.baseRole, permissions: draft.permissions, ...(editing ? { isActive: draft.isActive } : {}) };
      const response = await fetch(editing ? `/api/v1/admin/roles/${editing.id}` : "/api/v1/admin/roles", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) throw new Error(messageFrom(result));
      toast.success(editing ? "Role updated." : "Role created.");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The role could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/roles/${deleting.id}`, { method: "DELETE" });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) throw new Error(messageFrom(result));
      toast.success("Role deleted.");
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The role could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  if (!roles && !failed) return <Skeleton className="h-96" />;
  if (failed || !roles) return <ErrorState title="Roles could not be loaded" />;

  return <>
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>Application roles</CardTitle><CardDescription>Manage custom roles and their server-enforced permission grants. System role identity cannot be changed or deleted.</CardDescription></div>
        {canCreate ? <Button onClick={openCreate}><Plus className="size-4" />Create role</Button> : null}
      </CardHeader>
      <CardContent>
        {roles.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Base access</TableHead><TableHead>Permissions</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>
          {roles.map((role) => <TableRow key={role.id}><TableCell><div className="font-medium">{role.name}</div><div className="text-xs text-muted-foreground">{role.slug}</div></TableCell><TableCell><Badge variant={role.isSystem ? "warning" : "secondary"}>{role.baseRole}</Badge></TableCell><TableCell><span className="text-sm text-muted-foreground">{role.baseRole === "SUPER_ADMIN" ? "Implicit unrestricted access" : `${role.permissions.length} granted`}</span></TableCell><TableCell><Badge variant={role.isActive ? "success" : "secondary"}>{role.isActive ? "ACTIVE" : "INACTIVE"}</Badge></TableCell><TableCell><div className="flex justify-end gap-2">{canEdit ? <Button variant="outline" size="sm" onClick={() => openEdit(role)}><Pencil className="size-4" />Edit</Button> : null}{canDelete && !role.isSystem ? <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(role)}><Trash2 className="size-4" /><span className="sr-only">Delete {role.name}</span></Button> : null}</div></TableCell></TableRow>)}
        </TableBody></Table></div> : <EmptyState title="No roles found" description="Create a custom role to delegate scoped administrative access." />}
      </CardContent>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : "Create role"}</DialogTitle><DialogDescription>{editing?.isSystem ? "System role identity is protected. You may only change its description and permission grants where applicable." : "Use a stable slug and grant only the permissions this role needs."}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-medium" htmlFor="role-name">Role name</label><Input id="role-name" value={draft.name} disabled={Boolean(editing?.isSystem)} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, ...(!editing && !current.slug ? { slug: slugFromName(event.target.value) } : {}) }))} /></div><div><label className="text-sm font-medium" htmlFor="role-slug">Role slug</label><Input id="role-slug" value={draft.slug} disabled={Boolean(editing)} onChange={(event) => setDraft((current) => ({ ...current, slug: slugFromName(event.target.value) }))} /><p className="mt-1 text-xs text-muted-foreground">Slugs are permanent after creation.</p></div></div>
      <div><label className="text-sm font-medium" htmlFor="role-description">Description</label><textarea id="role-description" value={draft.description} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-medium" htmlFor="role-base">Base access</label><select id="role-base" value={draft.baseRole} disabled={Boolean(editing?.isSystem)} onChange={(event) => setDraft((current) => ({ ...current, baseRole: event.target.value as Draft["baseRole"] }))} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="ADMIN">ADMIN</option><option value="STAFF">STAFF</option><option value="MEMBER">MEMBER</option>{editing?.isSystem && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}</select></div>{editing && !editing.isSystem ? <label className="mt-7 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />Active role</label> : null}</div>
      {draft.baseRole === "SUPER_ADMIN" ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"><ShieldAlert className="mr-2 inline size-4" />Super Admin permission access is implicit and cannot be edited.</div> : <fieldset><legend className="text-sm font-medium">Permissions</legend><p className="mt-1 text-xs text-muted-foreground">Sensitive grants should be assigned only to trusted operators.</p><div className="mt-3 grid gap-4 md:grid-cols-2">{permissionGroups.map(([category, permissions]) => <div className="rounded-lg border p-3" key={category}><p className="text-xs font-bold tracking-wide text-muted-foreground">{category}</p><div className="mt-2 space-y-2">{permissions.map((permission) => <label key={permission.key} className="flex cursor-pointer items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={draft.permissions.includes(permission.key)} onChange={(event) => updatePermission(permission.key, event.target.checked)} /><span><span className="font-medium">{permission.label}</span>{permission.sensitive ? <Badge className="ml-2" variant="warning">Sensitive</Badge> : null}<span className="block text-xs text-muted-foreground">{permission.description}</span></span></label>)}</div></div>)}</div></fieldset>}
      <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : <><Check className="size-4" />Save role</>}</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && !saving && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Delete role?</DialogTitle><DialogDescription>{deleting ? `Delete ${deleting.name}? This cannot be undone. Roles still assigned to users cannot be deleted.` : ""}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void remove()}>{saving ? "Deleting…" : "Delete role"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
