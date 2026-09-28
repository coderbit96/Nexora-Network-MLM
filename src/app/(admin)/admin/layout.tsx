import { adminNavigationAccess } from "@/config/admin-navigation-access";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminShell } from "@/lib/auth/admin-page-authorization";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAdminShell();
  const keys = new Set(context.permissions);
  const navigation = adminNavigationAccess.filter((item) => (!item.superAdminOnly || context.roles.includes("SUPER_ADMIN")) && (context.roles.includes("SUPER_ADMIN") || !item.permission || keys.has(item.permission)));
  return <DashboardShell area="Admin" navigationLabels={navigation.map((item) => item.label)}>{children}</DashboardShell>;
}
