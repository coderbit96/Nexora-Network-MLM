import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({ label, value, icon: Icon, description }: { label: string; value: string; icon: LucideIcon; description: string }) {
  return <Card className="transition-shadow hover:shadow-md"><CardContent className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div></CardContent></Card>;
}
