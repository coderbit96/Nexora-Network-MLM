import { PERMISSION } from "@/config/permissions";
import { withApiErrorHandling } from "@/lib/api";
import { requireAllPermissions } from "@/lib/auth/authorization";
import { createReportCsvStream, parseReportFilters } from "@/services/reports/report-service";

/** A withdrawal-specific export boundary; report export permission is not used. */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requireAllPermissions([PERMISSION.WITHDRAWALS.VIEW_ALL, PERMISSION.WITHDRAWALS.EXPORT], request);
  return new Response(
    createReportCsvStream("withdrawals", parseReportFilters(new URL(request.url).searchParams)),
    {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="nexora-withdrawals-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    },
  );
});
