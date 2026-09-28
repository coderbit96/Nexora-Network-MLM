"use client";

import { Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/shared/states";

type ApiData<T> = { success: true; data: T };
async function load<T>(path: string) { const response = await fetch(path); if (!response.ok) throw new Error("Request failed"); return (await response.json() as ApiData<T>).data; }
function useLoad<T>(path: string) { const [data, setData] = useState<T | null>(null); const [failed, setFailed] = useState(false); useEffect(() => { void load<T>(path).then(setData).catch(() => setFailed(true)); }, [path]); return { data, failed }; }

type ReferralData = { referralCode: string; referralUrl: string; statistics: { directReferrals: number; teamMembers: number }; sponsor: { name: string; memberNumber: string } | null };
export function ReferralPanel() {
  const { data, failed } = useLoad<ReferralData>("/api/v1/members/me/referral");
  if (!data && !failed) return <Skeleton className="h-64" />;
  if (failed || !data) return <ErrorState />;
  const copy = async () => { try { await navigator.clipboard.writeText(data.referralUrl); toast.success("Referral link copied."); } catch { toast.error("Copy is unavailable in this browser."); } };
  const share = async () => { if (navigator.share) await navigator.share({ title: "Join my Nexora network", url: data.referralUrl }); else await copy(); };
  return <div className="space-y-6"><Card><CardHeader><CardTitle>Your referral link</CardTitle><CardDescription>New members who use this link are permanently linked to your referral relationship.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-2 sm:flex-row"><Input readOnly value={data.referralUrl} aria-label="Referral URL" /><Button onClick={() => void copy()}><Copy className="size-4" />Copy</Button><Button variant="outline" onClick={() => void share()}><Share2 className="size-4" />Share</Button></div><p className="mt-3 text-sm text-muted-foreground">Referral code: <span className="font-semibold text-foreground">{data.referralCode}</span></p></CardContent></Card><div className="grid gap-4 sm:grid-cols-2"><Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Direct referrals</p><p className="mt-2 text-3xl font-bold">{data.statistics.directReferrals}</p></CardContent></Card><Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Total team</p><p className="mt-2 text-3xl font-bold">{data.statistics.teamMembers}</p></CardContent></Card></div><Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Your sponsor</p><p className="mt-1 font-semibold">{data.sponsor ? `${data.sponsor.name} · ${data.sponsor.memberNumber}` : "No sponsor recorded"}</p></CardContent></Card></div>;
}

type DirectData = { total: number; referrals: Array<{ memberNumber: string; name: string; status: string; joinedAt: string }> };
export function DirectReferralsPanel() {
  const { data, failed } = useLoad<DirectData>("/api/v1/members/me/direct-referrals");
  if (!data && !failed) return <Skeleton className="h-64" />;
  if (failed || !data) return <ErrorState />;
  if (!data.referrals.length) return <EmptyState title="No direct referrals yet" description="Share your referral link to start growing your direct network." />;
  return <Card><CardHeader><CardTitle>{data.total} direct referrals</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader><TableBody>{data.referrals.map((member) => <TableRow key={member.memberNumber}><TableCell><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.memberNumber}</p></TableCell><TableCell><Badge variant={member.status === "ACTIVE" ? "success" : "warning"}>{member.status}</Badge></TableCell><TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

type TeamData = { statistics: { directReferrals: number; teamMembers: number }; members: Array<{ memberNumber: string; name: string; status: string; level: number }> };
export function TeamPanel() {
  const { data, failed } = useLoad<TeamData>("/api/v1/members/me/team");
  if (!data && !failed) return <Skeleton className="h-64" />;
  if (failed || !data) return <ErrorState />;
  if (!data.members.length) return <EmptyState title="Your team is waiting to grow" description="Referral activity will appear here across all levels of your network." />;
  return <Card><CardHeader><CardTitle>{data.statistics.teamMembers} team members</CardTitle><CardDescription>Showing the most recent 100 members in your referral downline.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.members.map((member) => <TableRow key={member.memberNumber}><TableCell><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.memberNumber}</p></TableCell><TableCell>Level {member.level}</TableCell><TableCell><Badge variant={member.status === "ACTIVE" ? "success" : "warning"}>{member.status}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}
