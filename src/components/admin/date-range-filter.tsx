"use client";

import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";

type DateRange = { from: string; to: string };
type DateRangeFilterProps = { value: DateRange; onChange: (value: DateRange) => void; onApply?: () => void; disabled?: boolean };

/** Controlled dates only; callers decide the query and server validation. */
export function DateRangeFilter({ value, onChange, onApply, disabled = false }: DateRangeFilterProps) {
  return <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-medium text-muted-foreground">From<input aria-label="Start date" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" type="date" value={value.from} max={value.to || undefined} disabled={disabled} onChange={(event) => onChange({ ...value, from: event.target.value })} /></label><label className="grid gap-1 text-xs font-medium text-muted-foreground">To<input aria-label="End date" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" type="date" value={value.to} min={value.from || undefined} disabled={disabled} onChange={(event) => onChange({ ...value, to: event.target.value })} /></label>{onApply ? <Button type="button" variant="outline" disabled={disabled || !value.from || !value.to} onClick={onApply}><CalendarDays className="size-4" />Apply</Button> : null}</div>;
}
