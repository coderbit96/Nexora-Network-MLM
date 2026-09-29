import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { productCreateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getProductManagementPage, parseProductManagementFilters } from "@/services/catalog/product-management-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.PRODUCTS.VIEW, request);
  return apiSuccess({ ...(await getProductManagementPage(parseProductManagementFilters(new URL(request.url).searchParams))), capabilities: { create: hasPermission(context, PERMISSION.PRODUCTS.CREATE), edit: hasPermission(context, PERMISSION.PRODUCTS.EDIT), activate: hasPermission(context, PERMISSION.PRODUCTS.ACTIVATE) } });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.PRODUCTS.CREATE, request);
  const input = await parseJsonBody(request, productCreateSchema);
  if (input.status === "ACTIVE" && !hasPermission(context, PERMISSION.PRODUCTS.ACTIVATE)) throw errors.forbidden();
  const product = await CatalogService.createProduct(input, context.user._id, getAuditRequestContext(request));
  return apiSuccess({ id: String(product._id) }, { status: 201 });
});
