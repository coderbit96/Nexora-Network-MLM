import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { parseJsonBody } from "@/lib/validation/request";
import { categoryCreateSchema } from "@/lib/validation/catalog";
import { Category, Product } from "@/models";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

export const GET = withApiErrorHandling(async (request: Request) => {
  await requirePermission(PERMISSION.CATEGORIES.VIEW, request);
  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Product.aggregate<{ _id: import("mongoose").Types.ObjectId; count: number }>([{ $group: { _id: "$categoryId", count: { $sum: 1 } } }]),
  ]);
  const countByCategoryId = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  return apiSuccess(categories.map((category) => ({ id: String(category._id), name: category.name, slug: category.slug, description: category.description ?? "", status: category.status, productCount: countByCategoryId.get(String(category._id)) ?? 0 })));
});
export const POST = withApiErrorHandling(async (request: Request) => { const context = await requirePermission(PERMISSION.CATEGORIES.MANAGE, request); const category = await CatalogService.createCategory(await parseJsonBody(request, categoryCreateSchema), context.user._id, getAuditRequestContext(request)); return apiSuccess({ id: String(category._id) }, { status: 201 }); });
