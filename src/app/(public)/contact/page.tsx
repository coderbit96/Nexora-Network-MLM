import type { Metadata } from "next";
import { Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemSettingsService } from "@/services/settings/system-settings-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact", description: "Find the configured Nexora support channels.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  let contact = { email: "", phone: "", whatsapp: "" };
  try {
    const settings = await SystemSettingsService.read();
    contact = { email: settings.settings.contact.supportEmail, phone: settings.settings.contact.supportPhone, whatsapp: settings.settings.contact.whatsappNumber };
  } catch { /* The page remains useful even while configuration storage is unavailable. */ }
  const hasChannel = Boolean(contact.email || contact.phone || contact.whatsapp);

  return <section className="grid gap-10 lg:grid-cols-[1fr_.8fr]"><div><p className="eyebrow text-primary">Contact Nexora</p><h1 className="display-type mt-6 max-w-2xl text-5xl font-bold sm:text-7xl">Let’s keep support clear, too.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Published support details are configured by a Super Admin and surfaced here only when a real response channel exists.</p><div className="mt-10 flex items-center gap-3 text-sm font-semibold"><ShieldCheck className="size-5 text-primary" />No untracked requests. No dead inboxes.</div></div><Card className="self-start rounded-[1.2rem] border-black/15 shadow-none"><CardHeader><div className="grid size-11 place-items-center rounded-full bg-[#111] text-white">{hasChannel ? <MessageCircle className="size-5" /> : <Mail className="size-5" />}</div><CardTitle className="mt-5 text-xl">{hasChannel ? "Support contact" : "Support channel pending"}</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">{hasChannel ? <><p>Use one of the approved support channels below. Do not send account passwords, one-time codes, or payment credentials through chat.</p>{contact.email ? <a className="flex items-center gap-2 font-medium text-primary hover:underline" href={`mailto:${contact.email}`}><Mail className="size-4" />{contact.email}</a> : null}{contact.phone ? <a className="flex items-center gap-2 font-medium text-primary hover:underline" href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}><Phone className="size-4" />{contact.phone}</a> : null}{contact.whatsapp ? <a className="flex items-center gap-2 font-medium text-primary hover:underline" href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} rel="noreferrer" target="_blank"><MessageCircle className="size-4" />WhatsApp support</a> : null}</> : "A direct support route will only be published after it has a connected owner and response process. Until then, there is no inactive submission control to mislead members."}</CardContent></Card></section>;
}
