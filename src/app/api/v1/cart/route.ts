import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireRole } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { cartItemSchema } from "@/lib/validation/orders";
import { parseJsonBody } from "@/lib/validation/request";
import { CartService } from "@/services/cart/cart-service";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { cartOverview } from "@/services/orders/order-query";

async function overview(request: Request) { const context = await requireRole("MEMBER", request); const profile = await getMemberProfileByUserId(context.user._id); return { context, profile, data: await cartOverview(profile._id) }; }
const serialize = (data: Awaited<ReturnType<typeof cartOverview>>) => ({ ...data, subtotalMinor: data.subtotalMinor.toString(), items: data.items.map((item) => ({ ...item, unitPriceMinor: item.unitPriceMinor.toString(), lineTotalMinor: item.lineTotalMinor.toString() })) });
export const GET = withApiErrorHandling(async (request: Request) => apiSuccess(serialize((await overview(request)).data)));
export const PUT = withApiErrorHandling(async (request: Request) => { const { profile } = await overview(request); const input = await parseJsonBody(request, cartItemSchema); await CartService.setItem(profile._id, input.productId, input.quantity); return apiSuccess(serialize(await cartOverview(profile._id))); });
export const DELETE = withApiErrorHandling(async (request: Request) => { const { profile } = await overview(request); const productId = new URL(request.url).searchParams.get("productId"); if (!productId) throw errors.badRequest("Product identifier is required."); await CartService.removeItem(profile._id, productId); return apiSuccess(serialize(await cartOverview(profile._id))); });
