import Link from "next/link";

import { AppLogo } from "@/components/layout/app-logo";
import { WhatsAppFloatingButton } from "@/components/public/whatsapp-floating-button";

export function PublicFooter() {
  return (
    <>
      <footer className="bg-[#111] text-white">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_.7fr_.7fr] lg:px-8">
          <div><AppLogo /><p className="mt-5 max-w-sm text-sm leading-6 text-white/65">A clear operational system for accountable network growth, products, earnings, and member relationships.</p></div>
          <div><p className="eyebrow text-white/45">Explore</p><div className="mt-4 grid gap-3 text-sm font-medium"><Link href="/about" className="hover:text-white/70">Platform</Link><Link href="/products" className="hover:text-white/70">Products</Link><Link href="/contact" className="hover:text-white/70">Contact</Link></div></div>
          <div><p className="eyebrow text-white/45">Account</p><div className="mt-4 grid gap-3 text-sm font-medium"><Link href="/login" className="hover:text-white/70">Sign in</Link><Link href="/register" className="hover:text-white/70">Create account</Link></div></div>
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-[88rem] flex-wrap justify-between gap-3 px-4 py-5 text-xs text-white/45 sm:px-6 lg:px-8"><span>© {new Date().getFullYear()} Nexora Network</span><span>Secure operations. Clear relationships.</span></div></div>
      </footer>
      <WhatsAppFloatingButton />
    </>
  );
}
