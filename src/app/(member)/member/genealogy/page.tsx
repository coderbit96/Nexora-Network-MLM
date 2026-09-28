import { GenealogyExplorer } from "@/components/genealogy/genealogy-explorer";

export default function MemberGenealogyPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">My network</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Genealogy</h1><p className="mt-2 text-muted-foreground">Explore your upline and referral downline one branch at a time.</p></div><GenealogyExplorer mode="member" /></>; }
