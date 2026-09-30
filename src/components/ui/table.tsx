import * as React from "react";

import { cn } from "@/lib/utils/cn";

function Table({ className, "aria-label": ariaLabel, ...props }: React.ComponentProps<"table">) {
  return <div className="relative w-full overflow-x-auto overscroll-contain rounded-xl border border-border/80 [-webkit-overflow-scrolling:touch] focus-within:ring-2 focus-within:ring-ring/40" role="region" aria-label={ariaLabel ?? "Data table"} tabIndex={0}><p className="sr-only">Scroll horizontally to view all table columns.</p><table className={cn("w-full min-w-[640px] caption-bottom text-sm", className)} aria-label={ariaLabel} {...props} /></div>;
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) { return <thead className={cn("border-b bg-muted/45 [&_tr]:border-b", className)} {...props} />; }
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) { return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />; }
function TableRow({ className, ...props }: React.ComponentProps<"tr">) { return <tr className={cn("border-b transition-colors hover:bg-primary/[0.025]", className)} {...props} />; }
function TableHead({ className, ...props }: React.ComponentProps<"th">) { return <th className={cn("h-11 px-4 text-left align-middle text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground", className)} {...props} />; }
function TableCell({ className, ...props }: React.ComponentProps<"td">) { return <td className={cn("p-4 align-middle", className)} {...props} />; }
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) { return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />; }
export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow };
