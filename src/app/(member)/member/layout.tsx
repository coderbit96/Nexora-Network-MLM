import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  try { await requireRole("MEMBER"); } catch { redirect("/login"); }
  return <DashboardShell area="Member">{children}</DashboardShell>;
}
