import { ReportsDashboard } from "@/components/admin/reports-dashboard";
import { PERMISSION } from "@/config/permissions";
import { requirePermission } from "@/lib/auth/authorization";

export default async function ReportsPage() {
  await requirePermission(PERMISSION.REPORTS.VIEW);
  return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Business intelligence</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Reports</h1><p className="mt-2 text-muted-foreground">Review paginated operational records and export approved report data without exposing unrestricted datasets to the browser.</p></div><ReportsDashboard /></>;
}
