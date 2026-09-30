import Link from "next/link";

import { APP_NAME } from "@/config/constants";
import { NexoraMark } from "@/components/layout/nexora-mark";

export function AppLogo({ href = "/" }: { href?: string }) {
  return <Link href={href} className="flex items-center gap-2.5 font-semibold tracking-tight transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><NexoraMark className="size-8" /><span>{APP_NAME}</span></Link>;
}
