import { Sparkles } from "lucide-react";
import Link from "next/link";

import { APP_NAME } from "@/config/constants";

export function AppLogo({ href = "/" }: { href?: string }) {
  return <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-4" /></span><span>{APP_NAME}</span></Link>;
}
