import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/** Layout-only filter container. Query semantics stay with each domain endpoint. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end", className)}>{children}</div>;
}
