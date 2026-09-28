import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { parseCatalogFilters, publicProducts } from "@/services/catalog/catalog-query";

export const GET = withApiErrorHandling(async (request: Request) => { const page = await publicProducts(parseCatalogFilters(new URL(request.url).searchParams)); return apiSuccess({ products: page.products, pagination: { total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages } }); });
