import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  LockKeyhole,
  Network,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
  WalletCards,
  Waypoints,
} from "lucide-react";
import Link from "next/link";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Hero } from "@/components/public/hero";
import { LandingFaq } from "@/components/public/landing-faq";
import { PageTransition } from "@/components/shared/page-transition";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Governed network operations",
  description: "Nexora connects members, commerce, commissions, wallets, and withdrawals in one accountable network platform.",
  alternates: { canonical: "/" },
};

const principles = [
  ["01", "See your actual network", "Sponsors, referrals, team growth, and genealogy are modeled as durable relationships—not browser state.", Waypoints],
  ["02", "Operate with evidence", "Orders, commissions, wallet entries, and withdrawals retain the references required for review.", LockKeyhole],
  ["03", "Grow without ambiguity", "Members see their path. Administrators have governed access to operational controls.", CheckCircle2],
] as const;

const capabilities = [
  [UsersRound, "Member network", "Profiles, referrals, sponsor visibility, direct referrals, teams, and mobile-ready genealogy."],
  [CircleDollarSign, "Commission control", "Database-driven direct and level rules with idempotent processing and full source references."],
  [WalletCards, "Financial operations", "Ledger-backed wallets, guarded adjustments, reserved withdrawal funds, and auditable states."],
  [ShoppingBag, "Product commerce", "Authoritative products, cart and checkout values, order snapshots, and payment verification."],
  [ShieldCheck, "Governed access", "Server-verified identity, account status, roles, permissions, and activity records."],
  [Network, "Operator visibility", "Member, order, commission, payment, withdrawal, and operational reporting views."],
] as const;

const workflow = [
  ["01", "Join with a validated referral", "Registration resolves the referral code on the server, creates the member profile, wallet, and welcome notification."],
  ["02", "Build visible relationships", "Direct referrals, sponsor links, team totals, and genealogy are retrieved from the recorded member network."],
  ["03", "Buy verified catalogue items", "Checkout uses current server-side products, stock, prices, and PV/BV snapshots—not values sent by the browser."],
  ["04", "Credit an accountable ledger", "A verified eligible order activates idempotent commission processing, then creates immutable commission and wallet records."],
] as const;

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main id="main-content">
        <PageTransition>
        <Hero />

        <section className="mx-auto max-w-[88rem] px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-black/15 pb-9 lg:grid-cols-[.8fr_1.2fr]">
            <p className="eyebrow text-primary">The operating principle</p>
            <div>
              <h2 className="display-type max-w-3xl text-4xl font-bold sm:text-6xl">Clarity for the member. Control for the operator.</h2>
              <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">A network platform should make important work easier to verify, not harder to understand. Nexora treats sensitive workflows as server-owned domain operations.</p>
            </div>
          </div>
          <div className="grid divide-y divide-black/10 md:grid-cols-3 md:divide-x md:divide-y-0">
            {principles.map(([number, title, copy, Icon]) => (
              <article key={number} className="py-8 md:px-7 md:first:pl-0 md:last:pr-0">
                <div className="flex items-center justify-between"><span className="font-mono text-sm text-muted-foreground">{number}</span><Icon className="size-5" /></div>
                <h3 className="mt-16 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold">Built into Nexora <ArrowUpRight className="size-4" /></span>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#111] py-20 text-white sm:py-24">
          <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 border-b border-white/15 pb-12 lg:grid-cols-[.75fr_1.25fr]">
              <p className="eyebrow text-[#9eff6b]">One connected system</p>
              <div><h2 className="display-type max-w-4xl text-4xl font-bold sm:text-6xl">Every operational surface, tied to the same source of truth.</h2><p className="mt-6 max-w-2xl leading-7 text-white/65">Nexora is built around the workflows an accountable direct-selling operation needs today. The platform does not present unsupported compensation plans as though they are enabled.</p></div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(([Icon, title, copy], index) => (
                <article className="border-b border-white/15 py-8 md:px-7 md:odd:border-r md:odd:pr-7 md:even:pl-7 lg:border-r lg:px-7 lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(n+4)]:border-b-0 lg:first:pl-0 lg:[&:nth-child(4)]:pl-0" key={title}>
                  <div className="flex items-center justify-between"><span className="font-mono text-xs text-white/40">0{index + 1}</span><Icon className="size-5 text-[#9eff6b]" /></div>
                  <h3 className="mt-12 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/60">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div><p className="eyebrow text-primary">A safer sequence</p><h2 className="display-type mt-6 text-4xl font-bold sm:text-6xl">From registration to recorded earnings.</h2></div>
            <div className="grid gap-0 border-t border-black/15">
              {workflow.map(([number, title, copy]) => (
                <article className="grid gap-4 border-b border-black/15 py-6 sm:grid-cols-[4rem_1fr]" key={number}><span className="font-mono text-sm text-primary">{number}</span><div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{copy}</p></div></article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#e9ebff] py-20 sm:py-24"><div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow text-primary">Questions, answered</p><h2 className="display-type mt-6 text-4xl font-bold sm:text-6xl">Build on what is actually available.</h2><p className="mt-6 max-w-sm leading-7 text-muted-foreground">A concise operating model is clearer for members and easier to govern for administrators.</p></div><LandingFaq /></div></div></section>

        <section className="bg-[#243bd8] py-20 text-white sm:py-24"><div className="mx-auto grid max-w-[88rem] gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8"><div><p className="eyebrow text-white/65">Ready when your account is</p><h2 className="display-type mt-6 max-w-3xl text-4xl font-bold sm:text-6xl">Start with a platform that can explain its numbers.</h2></div><Button asChild className="h-12 rounded-full bg-white px-6 text-[#111] hover:bg-white/85"><Link href="/register">Create an account <ArrowRight className="size-4" /></Link></Button></div></section>
        </PageTransition>
      </main>
      <PublicFooter />
    </>
  );
}
