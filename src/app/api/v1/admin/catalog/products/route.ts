import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { productCreateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { adminProducts, parseCatalogFilters } from "@/services/catalog/catalog-query";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

export const GET = withApiErrorHandling(async (request: Request) => { await requirePermission(PERMISSION.PRODUCTS.VIEW, request); const page = await adminProducts(parseCatalogFilters(new URL(request.url).searchParams)); return apiSuccess({ products: page.products, pagination: { total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages } }); });
export const POST = withApiErrorHandling(async (request: Request) => { const context = await requirePermission(PERMISSION.PRODUCTS.CREATE, request); const product = await CatalogService.createProduct(await parseJsonBody(request, productCreateSchema), context.user._id, getAuditRequestContext(request)); return apiSuccess({ id: String(product._id) }, { status: 201 }); });
