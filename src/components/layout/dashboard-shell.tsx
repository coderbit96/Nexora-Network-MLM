"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppLogo } from "@/components/layout/app-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageTransition } from "@/components/shared/page-transition";
import { adminNavigation, memberNavigation, staffNavigation, type NavigationItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

type DashboardShellProps = {
  area: "Member" | "Admin" | "Staff";
  children: React.ReactNode;
  /** Serializable allow-list from a server layout. Icon components remain client-only. */
  navigationLabels?: string[];
};

function isCurrent(pathname: string, href?: string) {
  if (!href) return false;
  return href === pathname || (href !== "/admin" && href !== "/staff" && href !== "/member" && pathname.startsWith(`${href}/`));
}

function formatSegment(segment: string) {
  if (/^[a-f0-9]{24}$/i.test(segment)) return "Details";
  return segment.split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");
}

function WorkspaceBreadcrumbs({ area }: { area: DashboardShellProps["area"] }) {
  const pathname = usePathname();
  const root = area === "Admin" ? "/admin" : area === "Staff" ? "/staff" : "/member";
  const crumbSegments = pathname.split("/").filter(Boolean).slice(1);
  return <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 overflow-hidden text-xs text-muted-foreground sm:flex"><Link href={root} className="shrink-0 transition-colors hover:text-foreground">{area}</Link>{crumbSegments.map((segment, index) => <span className="flex min-w-0 items-center gap-1" key={`${segment}-${index}`}><ChevronRight className="size-3 shrink-0" aria-hidden="true" /><span className="truncate font-medium text-foreground">{formatSegment(segment)}</span></span>)}</nav>;
}

function SidebarContent({ area, navigation, collapsed = false, onNavigate }: { area: DashboardShellProps["area"]; navigation: NavigationItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const home = area === "Admin" ? "/admin" : area === "Staff" ? "/staff" : "/member";
  return <>
    <div className={cn("flex h-[4.5rem] shrink-0 items-center border-b border-white/10", collapsed ? "justify-center px-3" : "px-5")}><AppLogo href={home} /></div>
    <div className={cn("shrink-0 pt-5", collapsed ? "px-3 text-center" : "px-4")}><Badge className={cn(collapsed && "px-2")} variant={area === "Admin" ? "warning" : area === "Staff" ? "secondary" : "default"}><span className={cn(collapsed && "sr-only")}>{area} workspace</span><span className={cn(!collapsed && "sr-only")}>{area.charAt(0)}</span></Badge></div>
    <nav className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4", collapsed && "px-2")} aria-label={`${area} navigation`}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = isCurrent(pathname, item.href);
        const tooltip = collapsed ? item.label : item.description;
        if (item.disabled) return <div key={item.label} title={tooltip} className={cn("flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/70", collapsed && "justify-center px-2")}><Icon className="size-[18px] shrink-0" /><span className={cn(collapsed && "sr-only")}>{item.label}</span></div>;
        return <Link onClick={onNavigate} key={item.label} href={item.href!} title={tooltip} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70", active ? "bg-primary text-primary-foreground shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white", collapsed && "justify-center px-2")}><Icon className="size-[18px] shrink-0" /><span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>{active && !collapsed ? <ChevronRight className="ml-auto size-4 shrink-0" /> : null}</Link>;
      })}
    </nav>
  </>;
}

function ProfileMenu({ area, canOpenSettings }: { area: DashboardShellProps["area"]; canOpenSettings: boolean }) {
  // The same guarded workspace is used by SUPER_ADMIN and delegated ADMIN
  // users. Do not present an ordinary administrator as a Super Admin.
  const label = area;
  const initial = area === "Admin" ? "A" : area === "Staff" ? "S" : "M";
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full" aria-label="Open account menu"><span className="grid size-8 place-items-center rounded-full bg-[#111827] text-sm font-bold text-white">{initial}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel><span className="block">{label}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Active application access</span></DropdownMenuLabel>{canOpenSettings ? <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/admin/settings" className="cursor-pointer"><Settings className="mr-2 size-4" />System settings</Link></DropdownMenuItem></> : null}<DropdownMenuSeparator /><DropdownMenuItem asChild><LogoutButton compact /></DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

export function DashboardShell({ area, children, navigationLabels }: DashboardShellProps) {
  const reduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false); const [notificationOpen, setNotificationOpen] = useState(false); const [collapsed, setCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const baseNavigation = area === "Admin" ? adminNavigation : area === "Staff" ? staffNavigation : memberNavigation;
  // The server passes labels only. Lucide components are resolved from this client-side static configuration.
  const navigation: NavigationItem[] = useMemo(() => navigationLabels ? baseNavigation.filter((item) => navigationLabels.includes(item.label)) : baseNavigation, [baseNavigation, navigationLabels]);
  const canOpenSettings = area === "Admin" && navigation.some((item) => item.href === "/admin/settings");
  useEffect(() => { const saved = window.localStorage.getItem(`nexora-${area.toLowerCase()}-sidebar-collapsed`) === "true"; const frame = window.requestAnimationFrame(() => setCollapsed(saved)); return () => window.cancelAnimationFrame(frame); }, [area]);
  useEffect(() => { if (!mobileOpen) return; closeButtonRef.current?.focus(); const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); }; document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [mobileOpen]);
  useEffect(() => { if (!mobileOpen) return; const priorOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = priorOverflow; }; }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background">
      <a href="#workspace-content" className="sr-only fixed left-4 top-4 z-[70] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only">Skip to workspace content</a>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-800 bg-[#111827] text-white transition-[width] duration-200 lg:flex", collapsed ? "w-20" : "w-64")}><SidebarContent area={area} navigation={navigation} collapsed={collapsed} /></aside>
      <AnimatePresence>
        {mobileOpen ? <><motion.button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setMobileOpen(false)} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside id="mobile-workspace-navigation" role="dialog" aria-modal="true" aria-label={`${area} navigation`} className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col bg-[#111827] text-white shadow-2xl lg:hidden" initial={reduceMotion ? false : { x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "tween", duration: reduceMotion ? 0 : 0.18 }}><div className="absolute right-3 top-3"><Button ref={closeButtonRef} variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(false)}><X className="size-5" /><span className="sr-only">Close navigation</span></Button></div><SidebarContent area={area} navigation={navigation} onNavigate={() => setMobileOpen(false)} /></motion.aside></> : null}
      </AnimatePresence>
      <div className={cn("transition-[padding-left] duration-200", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        <header aria-label="Workspace header" className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b bg-background/92 px-4 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-expanded={mobileOpen} aria-controls="mobile-workspace-navigation" onClick={() => setMobileOpen(true)}><Menu className="size-5" /><span className="sr-only">Open navigation</span></Button><Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => { const next = !value; window.localStorage.setItem(`nexora-${area.toLowerCase()}-sidebar-collapsed`, String(next)); return next; })}>{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</Button><div className="min-w-0"><p className="eyebrow truncate text-[.6rem] text-muted-foreground">{`${area} workspace`}</p><p className="mt-1 truncate text-sm font-semibold">Operational control center</p></div></div><div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><Button variant="ghost" size="icon" onClick={() => setNotificationOpen(true)} aria-label="Open notifications"><Bell className="size-5" /></Button><ProfileMenu area={area} canOpenSettings={canOpenSettings} /></div></header>
        <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Notifications</DialogTitle></DialogHeader><NotificationCenter compact /></DialogContent></Dialog>
        <main id="workspace-content" tabIndex={-1} className="mx-auto w-full max-w-7xl p-4 pb-8 outline-none sm:p-6 lg:p-8"><WorkspaceBreadcrumbs area={area} /><div className="mt-3"><PageTransition>{children}</PageTransition></div></main>
      </div>
    </div>
  );
}
