import { StaffManager } from "@/components/admin/staff-manager";

export default function StaffPage() {
  return <>
    <div className="mb-8"><p className="text-sm font-semibold text-primary">Access control</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Team & member accounts</h1><p className="mt-2 text-muted-foreground">Create and manage secure Admin, Staff, and Member sign-ins with database-backed role assignments. A member is provisioned with its profile, wallet, member ID, referral code, and optional sponsor relationship in one transaction.</p></div>
    <StaffManager />
  </>;
}
