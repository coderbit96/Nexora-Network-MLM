"use client";

import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";

type DateRange = { from: string; to: string };
type DateRangeFilterProps = { value: DateRange; onChange: (value: DateRange) => void; onApply?: () => void; disabled?: boolean };

/** Controlled dates only; callers decide the query and server validation. */
export function DateRangeFilter({ value, onChange, onApply, disabled = false }: DateRangeFilterProps) {
  return <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap"><label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">From<input aria-label="Start date" className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground sm:px-3" type="date" value={value.from} max={value.to || undefined} disabled={disabled} onChange={(event) => onChange({ ...value, from: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">To<input aria-label="End date" className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground sm:px-3" type="date" value={value.to} min={value.from || undefined} disabled={disabled} onChange={(event) => onChange({ ...value, to: event.target.value })} /></label>{onApply ? <Button className="col-span-2 w-full sm:w-auto" type="button" variant="outline" disabled={disabled || !value.from || !value.to} onClick={onApply}><CalendarDays className="size-4" />Apply</Button> : null}</div>;
}
