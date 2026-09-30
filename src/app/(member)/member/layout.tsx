import type { Metadata } from "next";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth/authorization";
import { AppError } from "@/lib/errors/app-error";
import { forbidden, redirect } from "next/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("MEMBER");
  } catch (error) {
    // Preserve the distinction between a missing Firebase session and an
    // authenticated account that is inactive or assigned to another workspace.
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login?next=/member");
    if (error instanceof AppError && error.statusCode === 403) forbidden();
    throw error;
  }
  return <DashboardShell area="Member">{children}</DashboardShell>;
}
