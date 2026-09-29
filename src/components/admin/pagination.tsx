"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = { page: number; totalPages: number; total?: number; onPageChange: (page: number) => void; className?: string };

export function Pagination({ page, totalPages, total, onPageChange, className }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  return <nav className={className} aria-label="Pagination"><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{typeof total === "number" ? `${total} records` : `Page ${page} of ${safeTotalPages}`}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" />Previous</Button><span className="min-w-20 text-center">Page {page} of {safeTotalPages}</span><Button size="sm" variant="outline" disabled={page >= safeTotalPages} onClick={() => onPageChange(page + 1)}>Next<ChevronRight className="size-4" /></Button></div></div></nav>;
}
