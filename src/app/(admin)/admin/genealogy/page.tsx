import { GenealogyExplorer } from "@/components/genealogy/genealogy-explorer";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminGenealogyPage() { return <><AdminPageHeader eyebrow="Network operations" title="Member genealogy" description="Search and inspect a member’s sponsor lineage and direct branches." /><GenealogyExplorer mode="admin" /></>; }
