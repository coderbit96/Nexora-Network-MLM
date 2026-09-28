import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { businessSettingsSchema } from "@/lib/validation/settings";
import { parseJsonBody } from "@/lib/validation/request";
import { SystemSettingsService } from "@/services/settings/system-settings-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

export const GET = withApiErrorHandling(async (request: Request) => {
  await requireRole("SUPER_ADMIN", request);
  return apiSuccess(await SystemSettingsService.read());
});

export const PATCH = withApiErrorHandling(async (request: Request) => {
  const context = await requireRole("SUPER_ADMIN", request);
  enforceRateLimit(`system-settings:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 15, 60_000);
  const settings = await parseJsonBody(request, businessSettingsSchema);
  const result = await SystemSettingsService.update({ settings, actorUserId: context.user._id, ...getAuditRequestContext(request) });
  return apiSuccess(result);
});
