import { Types } from "mongoose";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { memberOrder, serializeOrder } from "@/services/orders/order-query";

export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const context = await requireRole("MEMBER", request); const id = (await params).id; if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid order identifier."); const profile = await getMemberProfileByUserId(context.user._id); return apiSuccess(serializeOrder(await memberOrder(profile._id, id))); });
