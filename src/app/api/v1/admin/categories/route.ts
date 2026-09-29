import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { categoryCreateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getCategoryManagementPage, parseCategoryManagementFilters } from "@/services/catalog/category-management-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.CATEGORIES.VIEW, request);
  return apiSuccess({ ...(await getCategoryManagementPage(parseCategoryManagementFilters(new URL(request.url).searchParams))), capabilities: { manage: hasPermission(context, PERMISSION.CATEGORIES.MANAGE) } });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.CATEGORIES.MANAGE, request);
  const category = await CatalogService.createCategory(await parseJsonBody(request, categoryCreateSchema), context.user._id, getAuditRequestContext(request));
  return apiSuccess({ id: String(category._id) }, { status: 201 });
});
