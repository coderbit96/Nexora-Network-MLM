import { Types } from "mongoose";

import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { PaymentService } from "@/services/payments/payment-service";

export const POST = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { if (process.env.NODE_ENV === "production") throw errors.notFound(); const context = await requireRole("MEMBER", request); const id = (await params).id; if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid payment identifier."); const profile = await getMemberProfileByUserId(context.user._id); return apiSuccess(await PaymentService.simulateMockSuccess(profile._id, id)); });
