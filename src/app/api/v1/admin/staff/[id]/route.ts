import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { objectIdSchema, parseJsonBody } from "@/lib/validation/request";
import { updateStaffSchema } from "@/lib/validation/staff";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { StaffService } from "@/services/auth/staff-service";

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireAuth(request);
  enforceRateLimit(`admin-staff-update:${context.userId}`, 30, 60_000);
  const staffId = objectIdSchema.parse((await params).id);
  const input = await parseJsonBody(request, updateStaffSchema);
  await StaffService.update(staffId, input, context, { actorUserId: context.user._id, ...getAuditRequestContext(request) });
  return apiSuccess({ id: staffId, updated: true });
});
