"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AppLogo } from "@/components/layout/app-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageTransition } from "@/components/shared/page-transition";
import { adminNavigation, memberNavigation, type NavigationItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

type DashboardShellProps = {
  area: "Member" | "Admin";
  children: React.ReactNode;
  /** Serializable allow-list from a server layout. Icon components remain client-only. */
  navigationLabels?: string[];
};

function SidebarContent({ area, navigation, onNavigate }: { area: DashboardShellProps["area"]; navigation: NavigationItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-[4.5rem] items-center border-b border-white/10 px-5"><AppLogo href={area === "Admin" ? "/admin" : "/member"} /></div>
      <div className="px-4 pt-5"><Badge variant={area === "Admin" ? "warning" : "default"}>{area} workspace</Badge></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label={`${area} navigation`}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.href === pathname;
          if (item.disabled) {
            return <div key={item.label} title={item.description} className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/70"><Icon className="size-[18px]" /><span>{item.label}</span></div>;
          }
          return <Link onClick={onNavigate} key={item.label} href={item.href!} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-white/62 hover:bg-white/10 hover:text-white")}><Icon className="size-[18px]" /><span>{item.label}</span>{active && <ChevronRight className="ml-auto size-4" />}</Link>;
        })}
      </nav>
    </>
  );
}

export function DashboardShell({ area, children, navigationLabels }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false); const [notificationOpen, setNotificationOpen] = useState(false);
  const baseNavigation = area === "Admin" ? adminNavigation : memberNavigation;
  // The server passes labels only. Lucide components are resolved from this client-side static configuration.
  const navigation: NavigationItem[] = navigationLabels ? baseNavigation.filter((item) => navigationLabels.includes(item.label)) : baseNavigation;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-[#111827] text-white lg:flex"><SidebarContent area={area} navigation={navigation} /></aside>
      <AnimatePresence>
        {mobileOpen && <><motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setMobileOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside role="dialog" aria-modal="true" aria-label={`${area} navigation`} className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))] flex-col bg-[#111827] text-white shadow-2xl lg:hidden" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "tween", duration: 0.18 }}><div className="absolute right-3 top-3"><Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(false)}><X className="size-5" /><span className="sr-only">Close navigation</span></Button></div><SidebarContent area={area} navigation={navigation} onNavigate={() => setMobileOpen(false)} /></motion.aside></>}
      </AnimatePresence>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b bg-background/92 px-4 backdrop-blur sm:px-6"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /><span className="sr-only">Open navigation</span></Button><div className="min-w-0"><p className="eyebrow truncate text-[.6rem] text-muted-foreground">{area} workspace</p><p className="mt-1 truncate text-sm font-semibold">Operational control center</p></div></div><div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><Button variant="ghost" size="icon" onClick={() => setNotificationOpen(true)}><Bell className="size-5" /><span className="sr-only">Open notifications</span></Button><LogoutButton /><div aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#111827] text-sm font-bold text-white">{area === "Admin" ? "A" : "M"}</div></div></header>
        <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Notifications</DialogTitle></DialogHeader><NotificationCenter compact /></DialogContent></Dialog>
        <main className="mx-auto w-full max-w-7xl p-4 pb-8 sm:p-6 lg:p-8"><PageTransition>{children}</PageTransition></main>
      </div>
    </div>
  );
}
