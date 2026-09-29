import { Types } from "mongoose";

import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { categoryUpdateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { CatalogService } from "@/services/catalog/catalog-service";

async function categoryId(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid category identifier.");
  return id;
}

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requirePermission(PERMISSION.CATEGORIES.MANAGE, request);
  const category = await CatalogService.updateCategory(await categoryId(params), await parseJsonBody(request, categoryUpdateSchema), context.user._id, getAuditRequestContext(request));
  return apiSuccess({ id: String(category._id), status: category.status });
});
