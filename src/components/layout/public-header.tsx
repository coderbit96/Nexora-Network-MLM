"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const links = [["Platform", "/about"], ["Products", "/products"], ["Contact", "/contact"]] as const;
  const close = () => setOpen(false);
  return <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur"><div className="mx-auto flex h-[4.5rem] max-w-[88rem] items-center justify-between px-4 sm:px-6 lg:px-8"><AppLogo /><nav className="hidden items-center gap-7 text-sm font-semibold md:flex" aria-label="Primary navigation">{links.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-primary focus-visible:text-primary">{label}</Link>)}</nav><div className="flex items-center gap-1.5 sm:gap-2"><Button variant="ghost" className="hidden font-semibold sm:inline-flex" asChild><Link href="/login">Sign in</Link></Button><Button className="rounded-full bg-[#111827] px-4 hover:bg-slate-800 sm:px-5" asChild><Link href="/register">Join Nexora</Link></Button><Button variant="ghost" size="icon" className="md:hidden" aria-expanded={open} aria-controls="public-mobile-navigation" onClick={() => setOpen(true)}><Menu className="size-5" /><span className="sr-only">Open navigation</span></Button></div></div><AnimatePresence>{open ? <><motion.button aria-label="Close navigation" className="fixed inset-0 bg-slate-950/45 md:hidden" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} /><motion.nav id="public-mobile-navigation" aria-label="Mobile navigation" className="absolute inset-x-0 top-[4.5rem] border-b bg-card p-4 shadow-xl md:hidden" initial={reduceMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : 0.16 }}><div className="flex items-center justify-between border-b pb-3"><p className="text-sm font-semibold">Explore Nexora</p><Button size="icon" variant="ghost" onClick={close}><X className="size-4" /><span className="sr-only">Close navigation</span></Button></div><div className="grid gap-1 pt-3">{links.map(([label, href]) => <Link onClick={close} key={href} href={href} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-muted">{label}</Link>)}<Link onClick={close} href="/login" className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-muted sm:hidden">Sign in</Link></div></motion.nav></> : null}</AnimatePresence></header>;
}
