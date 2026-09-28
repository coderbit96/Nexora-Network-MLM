"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils/format";

type Item = { id: string; title: string; body: string; actionUrl?: string; read: boolean; createdAt: string };
type Data = { notifications: Item[]; unreadCount: number; pagination: { total: number; page: number; totalPages: number } };

export function NotificationCenter({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const load = useCallback(async () => { try { const response = await fetch(`/api/v1/notifications?limit=${compact ? 6 : 30}`); const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(); setData(payload.data); setFailed(false); } catch { setFailed(true); } }, [compact]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const mark = async (ids?: string[]) => { setMarking(ids?.[0] ?? "all"); try { const response = await fetch("/api/v1/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(ids ? { ids } : { all: true }) }); if (!response.ok) throw new Error(); await load(); } finally { setMarking(null); } };

  if (!data && !failed) return <Skeleton className="h-48" />;
  if (failed || !data) return <ErrorState title="Notifications could not be loaded" description="Please try again to refresh your latest account updates." />;
  return <Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Bell className="size-4" />Notifications {data.unreadCount ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{data.unreadCount}</span> : null}</CardTitle>{data.unreadCount ? <Button size="sm" variant="ghost" disabled={marking !== null} onClick={() => void mark()}><CheckCheck className="size-4" />Mark all read</Button> : null}</CardHeader><CardContent className="space-y-1">{data.notifications.length ? data.notifications.map((item) => { const content = <><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.body}</p><p className="mt-1.5 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p></>; return item.actionUrl ? <Link key={item.id} href={item.actionUrl} onClick={() => { if (!item.read) void mark([item.id]); }} className={`block rounded-xl p-3 transition-colors hover:bg-muted ${item.read ? "" : "bg-primary/5"}`}>{content}</Link> : <button type="button" key={item.id} disabled={item.read || marking === item.id} onClick={() => void mark([item.id])} className={`block w-full rounded-xl p-3 text-left transition-colors hover:bg-muted disabled:cursor-default ${item.read ? "" : "bg-primary/5"}`}>{content}</button>; }) : <EmptyState title="You’re all caught up" description="New order, commission, and account updates will appear here." />}</CardContent></Card>;
}
