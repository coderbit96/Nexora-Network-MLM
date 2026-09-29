import type { ReactNode } from "react";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DataTableProps = { columns: Array<{ key: string; label: string; className?: string }>; children: ReactNode; label?: string };

/** Accessible table frame; domain screens own row rendering and query behavior. */
export function DataTable({ columns, children, label = "Data table" }: DataTableProps) {
  return <Table aria-label={label}><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} className={column.className}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table>;
}
