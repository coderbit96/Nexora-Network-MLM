import { StaffManager } from "@/components/admin/staff-manager";

export default function StaffPage() {
  return <>
    <div className="mb-8"><p className="text-sm font-semibold text-primary">Access control</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Team accounts</h1><p className="mt-2 text-muted-foreground">Create and manage Admin and Staff sign-ins with database-backed, least-privilege role assignments. Member accounts are created through member registration so their wallet, member ID, and referral record are initialized together.</p></div>
    <StaffManager />
  </>;
}
