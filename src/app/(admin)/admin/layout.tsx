import type { Metadata } from "next";

import { adminNavigationAccess } from "@/config/admin-navigation-access";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAdminShell } from "@/lib/auth/admin-page-authorization";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAdminShell();
  const keys = new Set(context.permissions);
  const navigation = adminNavigationAccess.filter((item) => (!item.superAdminOnly || context.roles.includes("SUPER_ADMIN")) && (context.roles.includes("SUPER_ADMIN") || !item.permission || keys.has(item.permission)));
  // Staff operations reuse guarded admin modules so their data and mutations
  // remain canonical. Keep the staff shell when they open those modules so
  // navigation, the profile menu, and the return path stay in their workspace.
  const area = context.roles.includes("STAFF") && !context.roles.includes("ADMIN") && !context.roles.includes("SUPER_ADMIN") ? "Staff" : "Admin";
  return <DashboardShell area={area} navigationLabels={navigation.map((item) => item.label)}>{children}</DashboardShell>;
}
