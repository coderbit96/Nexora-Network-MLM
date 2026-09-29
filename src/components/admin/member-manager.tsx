"use client";

import Link from "next/link";
import { Eye, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils/format";

type Member = { id: string; memberNumber: string; name: string; email: string; phone: string; referralCode: string; sponsor: { memberNumber: string; name: string } | null; status: string; accountStatus: string; directReferrals: number | null; teamSize: number | null; joinedAt: string };
type ApiResponse = { success: true; data: { items: Member[]; pagination: { total: number; page: number; limit: number; totalPages: number } } } | { success: false; error?: { message?: string } };

export function MemberManager() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState(""); const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState(""); const [sponsor, setSponsor] = useState(""); const [submittedSponsor, setSubmittedSponsor] = useState("");
  const [range, setRange] = useState({ from: "", to: "" }); const [submittedRange, setSubmittedRange] = useState({ from: "", to: "" });
  const [sort, setSort] = useState("newest"); const [failed, setFailed] = useState(false);
  const query = useMemo(() => new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit), sort, ...(submittedSearch ? { q: submittedSearch } : {}), ...(status ? { status } : {}), ...(submittedSponsor ? { sponsor: submittedSponsor } : {}), ...(submittedRange.from ? { from: submittedRange.from } : {}), ...(submittedRange.to ? { to: submittedRange.to } : {}) }).toString(), [pagination.page, pagination.limit, sort, submittedSearch, status, submittedSponsor, submittedRange]);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/admin/members?${query}`, { cache: "no-store" });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.success) throw new Error(payload.success ? "" : payload.error?.message);
      setMembers(payload.data.items); setPagination(payload.data.pagination); setFailed(false);
    } catch { setFailed(true); }
  }, [query]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const apply = () => { setPagination((current) => ({ ...current, page: 1 })); setSubmittedSearch(search.trim()); setSubmittedSponsor(sponsor.trim()); };
  if (!members && !failed) return <Skeleton className="h-[32rem]" />;
  if (!members || failed) return <ErrorState title="Members could not be loaded" description="Refresh the page or check that your account has member-management access." />;
  return <Card>
    <CardHeader className="gap-4"><div><CardTitle>Member directory</CardTitle><CardDescription>Search profiles and review member account health without exposing financial edits.</CardDescription></div>
      <FilterBar><form className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); apply(); }}><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, name, email, phone, referral code" aria-label="Search members" /><Button type="submit" variant="outline"><Search className="size-4" />Search</Button></form>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">Status<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }}><option value="">All statuses</option>{["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid min-w-44 gap-1 text-xs font-medium text-muted-foreground">Sponsor<Input value={sponsor} onChange={(event) => setSponsor(event.target.value)} placeholder="Name, ID or referral" /></label>
        <DateRangeFilter value={range} onChange={setRange} onApply={() => { setSubmittedRange(range); setPagination((current) => ({ ...current, page: 1 })); }} />
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">Sort<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={sort} onChange={(event) => { setSort(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }}><option value="newest">Newest joined</option><option value="oldest">Oldest joined</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option></select></label>
        <Button type="button" variant="ghost" onClick={() => { setSearch(""); setSubmittedSearch(""); setSponsor(""); setSubmittedSponsor(""); setRange({ from: "", to: "" }); setSubmittedRange({ from: "", to: "" }); setStatus(""); setSort("newest"); setPagination((current) => ({ ...current, page: 1 })); }}><SlidersHorizontal className="size-4" />Reset</Button>
      </FilterBar>
    </CardHeader>
    <CardContent>{members.length ? <><div className="hidden overflow-x-auto lg:block"><Table><TableHeader><TableRow>{["Member ID", "Name", "Email", "Phone", "Sponsor", "Status", "Direct referrals", "Team size", "Join date", ""].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.id}><TableCell className="font-medium">{member.memberNumber}</TableCell><TableCell>{member.name}</TableCell><TableCell>{member.email}</TableCell><TableCell>{member.phone}</TableCell><TableCell>{member.sponsor ? <span>{member.sponsor.name}<span className="block text-xs text-muted-foreground">{member.sponsor.memberNumber}</span></span> : "—"}</TableCell><TableCell><StatusBadge status={member.status} /></TableCell><TableCell>{member.directReferrals}</TableCell><TableCell>{member.teamSize}</TableCell><TableCell className="whitespace-nowrap">{formatDateTime(member.joinedAt)}</TableCell><TableCell><Button asChild size="sm" variant="outline"><Link href={`/admin/members/${member.id}`}><Eye className="size-4" />View</Link></Button></TableCell></TableRow>)}</TableBody></Table></div>
      <div className="grid gap-3 lg:hidden">{members.map((member) => <article key={member.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{member.name}</p><p className="text-sm text-muted-foreground">{member.memberNumber} · {member.email}</p></div><StatusBadge status={member.status} /></div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Sponsor</dt><dd>{member.sponsor?.name ?? "—"}</dd></div><div><dt className="text-muted-foreground">Join date</dt><dd>{formatDateTime(member.joinedAt)}</dd></div><div><dt className="text-muted-foreground">Direct / team</dt><dd>{member.directReferrals ?? "—"} / {member.teamSize ?? "—"}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd>{member.phone}</dd></div></dl><Button className="mt-4 w-full" asChild variant="outline"><Link href={`/admin/members/${member.id}`}>Open member</Link></Button></article>)}</div>
      <Pagination className="mt-5" total={pagination.total} page={pagination.page} totalPages={pagination.totalPages} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} /></> : <EmptyState title="No members found" description="Try a different search, sponsor, date, or status filter." />}</CardContent>
  </Card>;
}
