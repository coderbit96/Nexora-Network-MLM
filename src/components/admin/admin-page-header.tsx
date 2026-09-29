import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/** Consistent page heading without coupling a page to a specific action or data source. */
export function AdminPageHeader({ eyebrow, title, description, actions, className }: AdminPageHeaderProps) {
  return <header className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0">
      {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2rem]">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>;
}
