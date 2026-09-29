import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, Boxes, CreditCard, Package, ReceiptText, ShieldCheck, UserRoundCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNavigation } from "@/config/navigation";
import { requireAuth } from "@/lib/auth/authorization";
import { hasPermission } from "@/lib/auth/policy";
import { getStaffDashboard, type StaffQueue } from "@/services/dashboard/staff-dashboard";

const queueIcons = {
  members: Users,
  "withdrawals-approve": UserRoundCheck,
  "withdrawals-process": BadgeIndianRupee,
  "withdrawals-complete": BadgeIndianRupee,
  orders: ReceiptText,
  payments: CreditCard,
  products: Package,
} satisfies Record<StaffQueue["key"], typeof Boxes>;

export default async function StaffDashboardPage() {
  const context = await requireAuth();
  const dashboard = await getStaffDashboard(context);
  const actions = adminNavigation.filter((item) => item.label !== "Dashboard" && item.href && item.permission && hasPermission(context, item.permission));

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.12] via-card to-card p-6 sm:p-8">
      <div className="absolute -right-10 -top-14 size-52 rounded-full bg-primary/[0.08] blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><Badge variant="secondary">Staff workspace</Badge><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {context.user.displayName}.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Your work queue is built from the permissions assigned to your role. Server-side authorization still validates every page and action.</p></div>
        <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm backdrop-blur"><p className="text-xs font-medium text-muted-foreground">Granted functions</p><p className="mt-1 text-2xl font-bold">{dashboard.assignedFunctionCount}</p></div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><div><h2 className="font-semibold">Priority work queue</h2><p className="text-sm text-muted-foreground">Only queues you are authorized to open are shown here.</p></div></div>
      {dashboard.queues.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{dashboard.queues.map((queue) => { const Icon = queueIcons[queue.key]; return <Link key={queue.key} href={queue.href} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus:outline-none focus:ring-2 focus:ring-primary"><div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><p className="mt-5 text-3xl font-bold tracking-tight">{queue.count}</p><h3 className="mt-1 font-semibold">{queue.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{queue.description}</p></Link>; })}</div> : <Card><CardHeader><CardTitle>No priority queue assigned</CardTitle><CardDescription>Your current role does not include a queue-based operational function.</CardDescription></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Ask a Super Admin to add the exact permissions you need, such as withdrawal review, order management, payment review, or member access.</CardContent></Card>}
    </section>

    <section>
      <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><div><h2 className="font-semibold">Your assigned operations</h2><p className="text-sm text-muted-foreground">Open an operational module granted to your role.</p></div></div>
      {actions.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{actions.map((item) => { const Icon = item.icon; return <Link key={item.label} href={item.href!} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus:outline-none focus:ring-2 focus:ring-primary"><div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><h3 className="mt-5 font-semibold">{item.label}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Open the {item.label.toLowerCase()} operations assigned to your role.</p></Link>; })}</div> : <Card><CardHeader><CardTitle>No operational functions assigned</CardTitle><CardDescription>Your account is active, but its role has no operational permissions yet.</CardDescription></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Ask a Super Admin to edit your role and assign the functions you need. You will see them here after your next sign-in.</CardContent></Card>}
    </section>
  </div>;
}
