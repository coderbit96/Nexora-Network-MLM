import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { REPORT_PERMISSION } from "@/config/report-permissions";
import { errors } from "@/lib/errors/app-error";
import { getReportPage, parseReportFilters, REPORT_NAMES, type ReportName } from "@/services/reports/report-service";

export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ report: string }> }) => {
  const context = await requirePermission(PERMISSION.REPORTS.VIEW, request);
  const report = (await params).report as ReportName;
  if (!REPORT_NAMES.includes(report)) throw errors.notFound();
  if (!hasPermission(context, REPORT_PERMISSION[report])) throw errors.forbidden();
  return apiSuccess(await getReportPage(report, parseReportFilters(new URL(request.url).searchParams)));
});
