import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { adminNavigationAccess } from "@/config/admin-navigation-access";
import { requireAuth } from "@/lib/auth/authorization";
import { hasRole } from "@/lib/auth/policy";
import { AppError } from "@/lib/errors/app-error";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  let context;
  try {
    context = await requireAuth();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login?next=/staff");
    forbidden();
  }
  if (!hasRole(context, "STAFF")) forbidden();

  const permissionKeys = new Set(context.permissions);
  const navigationLabels = ["Dashboard", ...adminNavigationAccess
    .filter((item) => item.label !== "Dashboard" && !item.superAdminOnly && (!item.permission || permissionKeys.has(item.permission)))
    .map((item) => item.label)];

  return <DashboardShell area="Staff" navigationLabels={navigationLabels}>{children}</DashboardShell>;
}
