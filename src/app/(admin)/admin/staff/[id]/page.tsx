import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StaffAccountForm } from "@/components/admin/staff-account-form";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><AdminPageHeader eyebrow="Access control" title="Staff details" description="Manage a staff account through audited, role-aware controls." /><StaffAccountForm staffId={id} /></>;
}
