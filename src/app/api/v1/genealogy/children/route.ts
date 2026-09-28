import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { getGenealogyAccess, parseLimit, parsePage, requireMemberNumber } from "@/services/genealogy/access";
import { canMemberAccessNode, getDirectChildren, getMemberByNumber } from "@/services/genealogy/genealogy";
import { errors } from "@/lib/errors/app-error";

export const GET = withApiErrorHandling(async (request: Request) => {
  const params = new URL(request.url).searchParams; const access = await getGenealogyAccess(request); const parent = await getMemberByNumber(requireMemberNumber(params.get("parent")));
  if (!access.elevated && !(await canMemberAccessNode(access.profile!._id, parent._id))) throw errors.forbidden("You can only view your own genealogy and downline.");
  return apiSuccess(await getDirectChildren(parent._id, parsePage(params.get("page")), parseLimit(params.get("limit"))));
});
