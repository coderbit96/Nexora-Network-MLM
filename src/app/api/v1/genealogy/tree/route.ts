import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { errors } from "@/lib/errors/app-error";
import { getGenealogyAccess, parseLimit, parsePage } from "@/services/genealogy/access";
import { canMemberAccessNode, getGenealogyRoot, getMemberByNumber } from "@/services/genealogy/genealogy";

export const GET = withApiErrorHandling(async (request: Request) => {
  const params = new URL(request.url).searchParams; const access = await getGenealogyAccess(request);
  let target = access.profile;
  const root = params.get("root");
  if (root) target = await getMemberByNumber(root);
  else if (access.elevated) throw errors.badRequest("Select a member to inspect their genealogy.");
  if (!target) throw errors.badRequest("Select a member to inspect their genealogy.");
  if (!access.elevated && !(await canMemberAccessNode(access.profile!._id, target._id))) throw errors.forbidden("You can only view your own genealogy and downline.");
  return apiSuccess(await getGenealogyRoot(target._id, parsePage(params.get("page")), parseLimit(params.get("limit"))));
});
