import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { getGenealogyAccess } from "@/services/genealogy/access";
import { searchGenealogy } from "@/services/genealogy/genealogy";

export const GET = withApiErrorHandling(async (request: Request) => {
  const query = new URL(request.url).searchParams.get("q") ?? ""; const access = await getGenealogyAccess(request);
  return apiSuccess({ results: await searchGenealogy(query, access.elevated ? undefined : access.profile!._id) });
});
