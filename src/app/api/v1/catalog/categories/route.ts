import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { publicCategories } from "@/services/catalog/catalog-query";

export const GET = withApiErrorHandling(async () => apiSuccess((await publicCategories()).map((category) => ({ id: String(category._id), name: category.name, slug: category.slug, description: category.description ?? "" }))));
