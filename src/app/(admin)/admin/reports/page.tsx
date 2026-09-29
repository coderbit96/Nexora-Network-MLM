import { ReportsDashboard } from "@/components/admin/reports-dashboard";
import { PERMISSION } from "@/config/permissions";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { REPORT_NAMES, REPORT_PERMISSION } from "@/config/report-permissions";

export default async function ReportsPage() {
  const context = await requirePermission(PERMISSION.REPORTS.VIEW);
  const allowedReports = REPORT_NAMES.filter((name) => hasPermission(context, REPORT_PERMISSION[name]));
  return <><div className="mb-8"><p className="text-sm font-semibold text-primary">Business intelligence</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Reports</h1><p className="mt-2 text-muted-foreground">Review paginated operational records and export approved report data without exposing unrestricted datasets to the browser.</p></div><ReportsDashboard allowedReports={allowedReports} canExport={hasPermission(context, PERMISSION.REPORTS.EXPORT)} /></>;
}
