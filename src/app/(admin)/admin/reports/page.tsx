import { ReportsDashboard } from "@/components/admin/reports-dashboard";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PERMISSION } from "@/config/permissions";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { REPORT_NAMES, REPORT_PERMISSION } from "@/config/report-permissions";

export default async function ReportsPage() {
  const context = await requirePermission(PERMISSION.REPORTS.VIEW);
  const allowedReports = REPORT_NAMES.filter((name) => hasPermission(context, REPORT_PERMISSION[name]));
  return <><AdminPageHeader eyebrow="Business intelligence" title="Reports" description="Review paginated operational records and export approved report data without exposing unrestricted datasets to the browser." /><ReportsDashboard allowedReports={allowedReports} canExport={hasPermission(context, PERMISSION.REPORTS.EXPORT)} /></>;
}
