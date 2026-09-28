import { GenealogyExplorer } from "@/components/genealogy/genealogy-explorer";

export default function AdminGenealogyPage() { return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Network operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Member genealogy</h1><p className="mt-2 text-muted-foreground">Search and inspect a member’s sponsor lineage and direct branches.</p></div><GenealogyExplorer mode="admin" /></>; }
