import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { APP_NAME } from "@/config/constants";
import { getSiteUrl } from "@/lib/seo/site-url";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const appUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: appUrl,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "A secure, modern network management platform for governed member, commerce, and financial operations.",
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: APP_NAME, title: APP_NAME, description: "A secure, modern network management platform." },
  twitter: { card: "summary", title: APP_NAME, description: "A secure, modern network management platform." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}><body className="min-h-full"><a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground" href="#main-content">Skip to content</a>{children}<Toaster richColors position="top-right" /></body></html>;
}
