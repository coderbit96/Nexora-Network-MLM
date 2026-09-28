import { PERMISSION } from "@/config/permissions";
import { withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { createReportCsvStream, parseReportFilters, REPORT_NAMES, type ReportName } from "@/services/reports/report-service";

export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ report: string }> }) => {
  await requirePermission(PERMISSION.REPORTS.EXPORT, request);
  const report = (await params).report as ReportName;
  if (!REPORT_NAMES.includes(report)) throw errors.notFound();
  return new Response(createReportCsvStream(report, parseReportFilters(new URL(request.url).searchParams)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nexora-${report}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
});
