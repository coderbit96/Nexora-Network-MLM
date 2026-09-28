import { StaffManager } from "@/components/admin/staff-manager";

export default function StaffPage() {
  return <>
    <div className="mb-8"><p className="text-sm font-semibold text-primary">Access control</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Staff</h1><p className="mt-2 text-muted-foreground">Create and manage staff identities with database-backed, least-privilege role assignments.</p></div>
    <StaffManager />
  </>;
}
