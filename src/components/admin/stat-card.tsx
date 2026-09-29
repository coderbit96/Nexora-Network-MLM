import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: LucideIcon;
  tone?: string;
};

export function StatCard({ label, value, detail, icon: Icon, tone = "bg-primary/10 text-primary" }: StatCardProps) {
  return <Card className="overflow-hidden"><CardContent className="flex items-start justify-between gap-3 p-4">
    <div className="min-w-0"><p className="truncate text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-bold tracking-tight">{value}</p>{detail ? <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p> : null}</div>
    {Icon ? <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}><Icon className="size-4" aria-hidden="true" /></span> : null}
  </CardContent></Card>;
}
