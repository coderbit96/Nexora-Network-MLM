"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  confirming?: boolean;
  destructive?: boolean;
  children?: ReactNode;
};

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", onConfirm, confirming = false, destructive = false, children }: ConfirmDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}<DialogFooter><Button type="button" variant="outline" disabled={confirming} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant={destructive ? "destructive" : "default"} disabled={confirming} onClick={() => void onConfirm()}>{confirming ? "Working…" : confirmLabel}</Button></DialogFooter></DialogContent></Dialog>;
}
