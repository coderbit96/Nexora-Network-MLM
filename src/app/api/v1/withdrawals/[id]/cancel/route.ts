import { Types } from "mongoose";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { withdrawalCancelSchema } from "@/lib/validation/withdrawal";
import { parseJsonBody } from "@/lib/validation/request";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { WithdrawalService } from "@/services/withdrawal/withdrawal-service";

export const POST = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requireRole("MEMBER", request); const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid withdrawal identifier.");
  const profile = await getMemberProfileByUserId(context.user._id); const body = await parseJsonBody(request, withdrawalCancelSchema);
  return apiSuccess(await WithdrawalService.transition({ withdrawalId: new Types.ObjectId(id), targetStatus: "CANCELLED", actorUserId: context.user._id, memberProfileId: profile._id, memberInitiated: true, note: body.note }));
});
