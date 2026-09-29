import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { parseDepth, parseLimit, parsePage, requireMemberNumber } from "@/services/genealogy/access";
import { GenealogyService } from "@/services/genealogy/genealogy";

const operations = ["search", "root", "children", "ancestors", "descendants", "stats"] as const;
type Operation = (typeof operations)[number];

/** Super Admin genealogy inspection only. No sponsorship mutation is exposed. */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.GENEALOGY.VIEW_ALL, request);
  const params = new URL(request.url).searchParams;
  const operation = params.get("operation") as Operation;
  if (!operations.includes(operation)) throw errors.badRequest("Invalid genealogy operation.");
  if (operation === "search") return apiSuccess({ results: await GenealogyService.search(params.get("q") ?? "") });
  const member = await GenealogyService.getMemberByNumber(requireMemberNumber(params.get("member")));
  if (operation === "root") return apiSuccess(await GenealogyService.getRoot(member._id, parsePage(params.get("page")), parseLimit(params.get("limit"))));
  if (operation === "children") return apiSuccess(await GenealogyService.getDirectReferrals(member._id, parsePage(params.get("page")), parseLimit(params.get("limit"))));
  if (operation === "ancestors") return apiSuccess({ ancestors: await GenealogyService.getAncestors(member._id, parseDepth(params.get("depth"))) });
  if (operation === "descendants") return apiSuccess({ members: await GenealogyService.getDescendants(member._id, parseDepth(params.get("depth")), parsePage(params.get("page")), parseLimit(params.get("limit"))) });
  return apiSuccess(await GenealogyService.getTeamStats(member._id));
});
