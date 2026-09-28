import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { getReportPage, parseReportFilters, REPORT_NAMES, type ReportName } from "@/services/reports/report-service";

export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ report: string }> }) => {
  await requirePermission(PERMISSION.REPORTS.VIEW, request);
  const report = (await params).report as ReportName;
  if (!REPORT_NAMES.includes(report)) throw errors.notFound();
  return apiSuccess(await getReportPage(report, parseReportFilters(new URL(request.url).searchParams)));
});
