import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { errors } from "@/lib/errors/app-error";
import { getGenealogyAccess, parseDepth, parseLimit, parsePage, requireMemberNumber } from "@/services/genealogy/access";
import { canMemberAccessNode, getDescendants, getMemberByNumber } from "@/services/genealogy/genealogy";

export const GET = withApiErrorHandling(async (request: Request) => {
  const params = new URL(request.url).searchParams; const access = await getGenealogyAccess(request); const root = await getMemberByNumber(requireMemberNumber(params.get("root")));
  if (!access.elevated && !(await canMemberAccessNode(access.profile!._id, root._id))) throw errors.forbidden("You can only view your own genealogy and downline.");
  return apiSuccess({ members: await getDescendants(root._id, parseDepth(params.get("depth")), parsePage(params.get("page")), parseLimit(params.get("limit"))) });
});
