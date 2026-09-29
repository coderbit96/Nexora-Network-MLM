"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, KeyRound, Search, ShieldAlert, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type PermissionCategory, type PermissionMetadata } from "@/config/permissions";

const CATEGORY_GUIDANCE: Record<PermissionCategory, { title: string; use: string }> = {
  DASHBOARD: { title: "Dashboard", use: "Use these when staff should see operational summaries and charts." },
  MEMBERS: { title: "Members", use: "Use these for member profiles, account status, and member data exports." },
  GENEALOGY: { title: "Network & genealogy", use: "Use these to let staff inspect referral trees and team structures." },
  COMMISSIONS: { title: "Commissions", use: "Use these for commission history, rules, recalculation, and exports." },
  WALLET: { title: "Wallet", use: "Use these for wallet history and controlled manual adjustments." },
  WITHDRAWALS: { title: "Withdrawals", use: "Give each financial step separately so one person cannot do every step by default." },
  PRODUCTS: { title: "Products", use: "Use these for catalog product viewing, creation, editing, activation, and archiving." },
  CATEGORIES: { title: "Categories", use: "Use these for product category viewing and management." },
  ORDERS: { title: "Orders", use: "Use these for member orders, fulfilment, cancellation, refunds, and exports." },
  PAYMENTS: { title: "Payments", use: "Use these only for trusted finance staff who verify or manage payment events." },
  REPORTS: { title: "Reports", use: "Use these to control which operational reports and exports a staff member can access." },
  NOTIFICATIONS: { title: "Notifications", use: "Use these for operational announcements and notification management." },
  STAFF: { title: "Staff", use: "Use these to view, create, edit, or disable staff accounts." },
  ROLES: { title: "Roles", use: "Use these carefully: roles control what other users can do." },
  SETTINGS: { title: "Settings", use: "Use these only for trusted operators who manage business configuration." },
  AUDIT: { title: "Audit logs", use: "Use these to review or export sanitized security and administrative history." },
  SYSTEM: { title: "System", use: "This is a highly privileged system-administration capability." },
};

type PermissionGuideProps = { permissions: readonly PermissionMetadata[] };

export function PermissionGuide({ permissions }: PermissionGuideProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PermissionCategory | "ALL">("ALL");
  const [sensitivity, setSensitivity] = useState<"ALL" | "SENSITIVE" | "STANDARD">("ALL");
  const normalized = search.trim().toLowerCase();
  const categories = useMemo(() => [...new Set(permissions.map((permission) => permission.category))], [permissions]);
  const visible = useMemo(() => permissions.filter((permission) => {
    const matchesCategory = category === "ALL" || permission.category === category;
    const matchesSensitivity = sensitivity === "ALL" || (sensitivity === "SENSITIVE" ? permission.sensitive : !permission.sensitive);
    const haystack = `${permission.key} ${permission.label} ${permission.description} ${permission.category}`.toLowerCase();
    return matchesCategory && matchesSensitivity && (!normalized || haystack.includes(normalized));
  }), [category, normalized, permissions, sensitivity]);
  const groups = categories.map((item) => [item, visible.filter((permission) => permission.category === item)] as const).filter(([, items]) => items.length);

  return <div className="space-y-6">
    <Card className="border-primary/20 bg-primary/[0.03]"><CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /><p className="font-semibold">Permissions are feature switches</p></div><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">A permission decides one specific action a role can perform. Create a role, select only the functions that role needs, then assign that role to staff. The server checks these permissions on every protected action.</p></div><Button asChild variant="outline"><Link href="/admin/roles">Manage roles<ChevronRight className="size-4" /></Link></Button></CardContent></Card>

    <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs font-bold tracking-wide text-primary">STEP 1</p><p className="mt-2 font-semibold">Create a role</p><p className="mt-1 text-sm text-muted-foreground">Example: Finance Staff or Product Manager.</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-bold tracking-wide text-primary">STEP 2</p><p className="mt-2 font-semibold">Choose functions</p><p className="mt-1 text-sm text-muted-foreground">Tick only the actions that role must perform.</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-bold tracking-wide text-primary">STEP 3</p><p className="mt-2 font-semibold">Assign to staff</p><p className="mt-1 text-sm text-muted-foreground">The staff user receives access immediately after signing in.</p></CardContent></Card></div>

    <Card><CardHeader><CardTitle>Common staff examples</CardTitle><CardDescription>Use these as a starting point, then keep access as limited as possible.</CardDescription></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3"><Example title="Finance staff" description="Reviews and approves withdrawals" permissions={["withdrawals.viewAll", "withdrawals.approve"]} /><Example title="Product manager" description="Maintains products and categories" permissions={["products.view", "products.create", "products.edit", "categories.manage"]} /><Example title="Support staff" description="Helps members without financial control" permissions={["dashboard.view", "members.view", "members.viewNetwork"]} /></CardContent></Card>

    <Card><CardHeader className="gap-4"><div><CardTitle>All functions</CardTitle><CardDescription>These are fixed, server-enforced permissions. Assign them from the Roles page; they cannot be edited or invented here.</CardDescription></div><div className="grid gap-2 sm:grid-cols-3"><div className="relative sm:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search a function" aria-label="Search permission functions" /></div><select value={category} onChange={(event) => setCategory(event.target.value as PermissionCategory | "ALL")} aria-label="Filter permission module" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="ALL">All modules</option>{categories.map((item) => <option key={item} value={item}>{CATEGORY_GUIDANCE[item].title}</option>)}</select><select value={sensitivity} onChange={(event) => setSensitivity(event.target.value as typeof sensitivity)} aria-label="Filter permission sensitivity" className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="ALL">All sensitivity</option><option value="SENSITIVE">Sensitive only</option><option value="STANDARD">Standard only</option></select></div></CardHeader><CardContent><div className="space-y-6">{groups.map(([group, items]) => <section key={group} aria-labelledby={`permission-group-${group}`}><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 id={`permission-group-${group}`} className="font-semibold">{CATEGORY_GUIDANCE[group].title}</h2><p className="mt-1 text-sm text-muted-foreground">{CATEGORY_GUIDANCE[group].use}</p></div><Badge variant="secondary">{items.length} functions</Badge></div><div className="grid gap-3 xl:grid-cols-2">{items.map((permission) => <article key={permission.key} className="rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{permission.label}</p><code className="mt-1 block text-xs text-primary">{permission.key}</code></div>{permission.sensitive ? <Badge variant="warning"><ShieldAlert className="size-3" />{riskLabel(permission)}</Badge> : <Badge variant="success"><CheckCircle2 className="size-3" />Standard</Badge>}</div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="secondary">Module: {CATEGORY_GUIDANCE[permission.category].title}</Badge><Badge variant={permission.sensitive ? "warning" : "success"}>Sensitivity: {permission.sensitive ? riskLabel(permission) : "Standard"}</Badge></div><p className="mt-3 text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">What it allows: </span>{permission.description}</p></article>)}</div></section>)}{!groups.length ? <div className="rounded-xl border border-dashed p-10 text-center"><UsersRound className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 font-medium">No matching function</p><p className="mt-1 text-sm text-muted-foreground">Try a shorter search term or choose a different module or sensitivity filter.</p></div> : null}</div></CardContent></Card>
  </div>;
}

function riskLabel(permission: PermissionMetadata) {
  if (["COMMISSIONS", "WALLET", "WITHDRAWALS", "PAYMENTS"].includes(permission.category)) return "Financial / sensitive";
  if (["STAFF", "ROLES", "SETTINGS", "AUDIT", "SYSTEM"].includes(permission.category)) return "Security / sensitive";
  return "Sensitive";
}

function Example({ title, description, permissions }: { title: string; description: string; permissions: string[] }) {
  return <div className="rounded-xl border p-4"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p><div className="mt-3 flex flex-wrap gap-2">{permissions.map((permission) => <code key={permission} className="rounded bg-muted px-2 py-1 text-xs text-foreground">{permission}</code>)}</div></div>;
}
