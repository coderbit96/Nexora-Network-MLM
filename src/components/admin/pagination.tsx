"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = { page: number; totalPages: number; total?: number; onPageChange: (page: number) => void; disabled?: boolean; className?: string };

export function Pagination({ page, totalPages, total, onPageChange, disabled = false, className }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  return <nav className={className} aria-label="Pagination"><div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span aria-live="polite">{typeof total === "number" ? `${total} records` : `Page ${page} of ${safeTotalPages}`}</span><div className="flex items-center justify-between gap-2 sm:justify-end"><Button size="sm" variant="outline" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Go to previous page"><ChevronLeft className="size-4" />Previous</Button><span className="min-w-20 text-center" aria-current="page">Page {page} of {safeTotalPages}</span><Button size="sm" variant="outline" disabled={disabled || page >= safeTotalPages} onClick={() => onPageChange(page + 1)} aria-label="Go to next page">Next<ChevronRight className="size-4" /></Button></div></div></nav>;
}
