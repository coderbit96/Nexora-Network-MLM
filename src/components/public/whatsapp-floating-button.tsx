"use client";

import { MessageCircle, Phone } from "lucide-react";

import { APP_NAME } from "@/config/constants";

const configuredNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER?.replace(/\D/g, "");
const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const message = `Hello, I would like to know more about ${APP_NAME}. ${applicationUrl}`;
const whatsappUrl = configuredNumber
  ? `https://wa.me/${configuredNumber}?text=${encodeURIComponent(message)}`
  : `https://wa.me/?text=${encodeURIComponent(`Discover ${APP_NAME}: ${applicationUrl}`)}`;

export function WhatsAppFloatingButton() {
  const isSupportChat = Boolean(configuredNumber);

  return <a aria-label={isSupportChat ? "Chat with Nexora on WhatsApp" : "Share Nexora on WhatsApp"} className="fixed bottom-5 right-5 z-50 grid size-16 place-items-center rounded-full border-4 border-white/15 bg-[#25D366] text-white shadow-[0_10px_26px_rgba(0,0,0,.35)] transition-transform hover:-translate-y-1 hover:scale-105 hover:bg-[#20c95d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6" href={whatsappUrl} rel="noreferrer" target="_blank"><span aria-hidden="true" className="relative grid size-9 place-items-center"><MessageCircle className="absolute size-9 fill-[#25D366] stroke-[2.5]" /><Phone className="relative size-4 -rotate-12 fill-white stroke-white" /></span><span className="sr-only">{isSupportChat ? "Open WhatsApp support chat" : "Open WhatsApp share"}</span></a>;
}
