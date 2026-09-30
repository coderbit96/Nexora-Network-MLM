"use client";

import { Check, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/auth/password-input";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";
type Role = { id: string; name: string; slug: string; baseRole: "ADMIN" | "STAFF" };
type Capabilities = { canCreate?: boolean; canEdit: boolean; canDisable: boolean; canAssignRoles: boolean };
type Staff = { id: string; name: string; email: string; status: Status; roles: Role[]; lastLoginAt?: string; createdAt: string; canManage: boolean };
type Form = { name: string; email: string; password: string; confirmPassword: string; roleId: string; status: Status };
const emptyForm = (): Form => ({ name: "", email: "", password: "", confirmPassword: "", roleId: "", status: "PENDING" });

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json() as { success?: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !body.success || !body.data) throw new Error(body.error?.message ?? "Request failed.");
  return body.data;
}

function statusOptions(capabilities: Capabilities, current?: Status) {
  const options: Status[] = [current ?? "PENDING"];
  if (capabilities.canEdit) options.push("PENDING", "ACTIVE", "SUSPENDED");
  if (capabilities.canDisable) options.push("DISABLED");
  return [...new Set(options)];
}

export function StaffAccountForm({ staffId }: { staffId?: string }) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities>({ canEdit: false, canDisable: false, canAssignRoles: false });
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { void (async () => {
    try {
      if (staffId) {
        const data = await api<{ staff: Staff; assignableRoles: Role[]; capabilities: Capabilities }>(`/api/v1/admin/staff/${staffId}`);
        setStaff(data.staff); setRoles(data.assignableRoles); setCapabilities(data.capabilities);
        setForm({ name: data.staff.name, email: data.staff.email, password: "", confirmPassword: "", roleId: data.staff.roles[0]?.id ?? "", status: data.staff.status });
      } else {
        const data = await api<{ roles: Role[]; capabilities: Capabilities }>("/api/v1/admin/staff/form-data");
        setRoles(data.roles); setCapabilities(data.capabilities); setForm((value) => ({ ...value, roleId: data.roles[0]?.id ?? "" }));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The staff account could not be loaded."); }
  })(); }, [staffId]);

  const canManage = staffId
    ? staff?.canManage === true && (capabilities.canEdit || capabilities.canDisable)
    : capabilities.canCreate === true;
  const canEditProfile = Boolean(canManage && capabilities.canEdit);
  const options = useMemo(() => statusOptions(capabilities, staff?.status), [capabilities, staff?.status]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (saving || !canManage) return;
    if (!staffId && form.password !== form.confirmPassword) { setError("The passwords do not match."); return; }
    setSaving(true); setError(null);
    try {
      const payload = staffId
        ? {
            ...(canEditProfile && form.name !== staff?.name ? { name: form.name } : {}),
            ...(canEditProfile && capabilities.canAssignRoles && form.roleId !== staff?.roles[0]?.id ? { roleId: form.roleId } : {}),
            ...(form.status !== staff?.status ? { status: form.status } : {}),
          }
        : { name: form.name, email: form.email, password: form.password, roleId: form.roleId, status: form.status };
      if (staffId && !Object.keys(payload).length) { router.push("/admin/staff"); return; }
      const result = await api<{ id: string }>(staffId ? `/api/v1/admin/staff/${staffId}` : "/api/v1/admin/staff", { method: staffId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      toast.success(staffId ? "Staff account updated." : "Staff account created.");
      router.push(`/admin/staff/${result.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The staff account could not be saved."); }
    finally { setSaving(false); setConfirmOpen(false); }
  }

  const requiresConfirmation = Boolean(staffId && staff && form.status !== staff.status && ["SUSPENDED", "DISABLED"].includes(form.status));
  function submit(event: React.FormEvent) { event.preventDefault(); if (requiresConfirmation) setConfirmOpen(true); else void save(); }

  if (error && !roles) return <ErrorState title="Staff account could not be loaded" description={error} />;
  if (!roles) return <Skeleton className="h-[40rem]" />;
  const canChangeRole = Boolean(canManage && capabilities.canAssignRoles && (staffId ? capabilities.canEdit : true));
  const canChangeStatus = Boolean(canManage && (capabilities.canEdit || capabilities.canDisable));

  return <><Card><CardHeader><CardTitle>{staffId ? "Staff account" : "Create staff account"}</CardTitle><CardDescription>{staffId ? "Account identity, role, and status changes are audited. Firebase passwords are never displayed or retrievable." : "Creates a Firebase sign-in and its MongoDB application account. The password is used only for secure Firebase provisioning and is never stored in audit logs."}</CardDescription></CardHeader><CardContent>{staffId && !staff?.canManage ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><ShieldAlert className="mr-2 inline size-4" />This protected account can be viewed but cannot be changed through staff management.</div> : null}<form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}><Field label="Name" value={form.name} disabled={staffId ? !canEditProfile : !canManage} onChange={(value) => set("name", value)} required />{staffId ? <div className="grid gap-2 text-sm"><span className="font-medium">Email</span><p className="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground">{form.email}</p></div> : <Field label="Email" value={form.email} type="email" disabled={!canManage} onChange={(value) => set("email", value)} required />}{!staffId ? <><div><label className="text-sm font-medium" htmlFor="new-staff-password">Temporary password</label><div className="mt-2"><PasswordInput id="new-staff-password" autoComplete="new-password" value={form.password} onChange={(event) => set("password", event.target.value)} /></div></div><div><label className="text-sm font-medium" htmlFor="new-staff-password-confirmation">Confirm password</label><div className="mt-2"><PasswordInput id="new-staff-password-confirmation" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => set("confirmPassword", event.target.value)} /></div></div></> : null}<label className="grid gap-2 text-sm font-medium">Role<select disabled={!canChangeRole} required className="h-10 rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" value={form.roleId} onChange={(event) => set("roleId", event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name} — {role.baseRole}</option>)}</select>{!canChangeRole ? <span className="text-xs font-normal text-muted-foreground">Role assignment requires staff edit and role assignment permission.</span> : null}</label><label className="grid gap-2 text-sm font-medium">Account status<select disabled={!canChangeStatus} className="h-10 rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" value={form.status} onChange={(event) => set("status", event.target.value as Status)}>{options.map((status) => <option key={status} value={status}>{status}</option>)}</select>{!canChangeStatus ? <span className="text-xs font-normal text-muted-foreground">Status changes require staff edit or staff disable permission.</span> : null}</label>{staff?.lastLoginAt ? <p className="text-sm text-muted-foreground md:col-span-2">Last login: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(staff.lastLoginAt))}</p> : staffId ? <p className="text-sm text-muted-foreground md:col-span-2">This account has not signed in yet.</p> : null}{error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive md:col-span-2">{error}</p> : null}<div className="flex flex-wrap gap-2 md:col-span-2">{canManage ? <Button type="submit" disabled={saving || !form.name.trim() || !form.roleId || (!staffId && (!form.email.trim() || !form.password || !form.confirmPassword))}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Saving</> : <><Check className="size-4" />Save staff</>}</Button> : null}<Button variant="outline" asChild><Link href="/admin/staff">Back to staff</Link></Button></div></form></CardContent></Card><ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={form.status === "DISABLED" ? "Disable staff account?" : "Suspend staff account?"} description={form.status === "DISABLED" ? "This blocks application access and Firebase sign-in. The change is audited." : "This blocks normal application access until the account is activated again. The change is audited."} confirmLabel={form.status === "DISABLED" ? "Disable account" : "Suspend account"} destructive onConfirm={save} confirming={saving} /></>;
}

function Field({ label, value, onChange, type = "text", disabled = false, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; required?: boolean }) {
  return <label className="grid gap-2 text-sm font-medium">{label}<Input type={type} value={value} disabled={disabled} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}
