import { ShieldOff } from "lucide-react";
import Link from "next/link";

import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return <main id="main-content" className="grid min-h-screen place-items-center bg-background p-5 sm:p-8"><section className="w-full max-w-lg rounded-2xl border bg-card p-6 text-center shadow-[0_12px_30px_rgb(15_23_42_/_0.08)] sm:p-10"><div className="flex justify-center"><AppLogo /></div><div className="mx-auto mt-9 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><ShieldOff className="size-7" aria-hidden="true" /></div><p className="eyebrow mt-6 text-destructive">403 Forbidden</p><h1 className="mt-3 text-3xl font-bold tracking-tight">You don’t have access to this workspace.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Your account is signed in, but it does not have the permission required to view this page. Contact a platform administrator if you believe this is unexpected.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/member">Go to my workspace</Link></Button><Button asChild variant="outline"><Link href="/">Return home</Link></Button></div></section></main>;
}
