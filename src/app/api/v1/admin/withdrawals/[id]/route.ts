import { Types } from "mongoose";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { parseJsonBody } from "@/lib/validation/request";
import { withdrawalTransitionSchema } from "@/lib/validation/withdrawal";
import { permissionForAdministrativeWithdrawalTransition } from "@/services/withdrawal/withdrawal-authorization";
import { WithdrawalService } from "@/services/withdrawal/withdrawal-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const body = await parseJsonBody(request, withdrawalTransitionSchema);
  const context = await requirePermission(permissionForAdministrativeWithdrawalTransition(body.status), request); const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid withdrawal identifier.");
  enforceRateLimit(`withdrawal-transition:${context.userId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 30, 60_000);
  return apiSuccess(await WithdrawalService.transition({ withdrawalId: new Types.ObjectId(id), targetStatus: body.status, actorUserId: context.user._id, note: body.note, paymentReference: body.paymentReference, ...getAuditRequestContext(request) }));
});
