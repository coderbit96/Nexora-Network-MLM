import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main id="main-content" className="grid min-h-screen place-items-center bg-muted/30 px-4 py-12"><section className="w-full max-w-md text-center"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">404</p><h1 className="mt-4 text-3xl font-bold tracking-tight">Page not found</h1><p className="mt-3 text-muted-foreground">The page may have moved, or the link may be incomplete.</p><Button asChild className="mt-7"><Link href="/">Return to the homepage</Link></Button></section></main>;
}
