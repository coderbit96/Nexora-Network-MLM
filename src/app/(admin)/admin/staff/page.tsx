import { StaffManager } from "@/components/admin/staff-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function StaffPage() {
  return <><AdminPageHeader eyebrow="Access control" title="Team & member accounts" description="Create and manage secure Admin, Staff, and Member sign-ins with database-backed role assignments. A member is provisioned with its profile, wallet, member ID, referral code, and optional sponsor relationship in one transaction." /><StaffManager /></>;
}
