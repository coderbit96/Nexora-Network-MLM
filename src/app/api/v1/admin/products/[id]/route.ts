import { Types } from "mongoose";

import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { productUpdateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getProductManagementDetail } from "@/services/catalog/product-management-query";

async function productId(params: Promise<{ id: string }>) { const { id } = await params; if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid product identifier."); return id; }

export const GET = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requirePermission(PERMISSION.PRODUCTS.VIEW, request);
  return apiSuccess({
    ...(await getProductManagementDetail(await productId(params))),
    capabilities: {
      edit: hasPermission(context, PERMISSION.PRODUCTS.EDIT),
      activate: hasPermission(context, PERMISSION.PRODUCTS.ACTIVATE),
    },
  });
});

export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const context = await requirePermission(PERMISSION.PRODUCTS.EDIT, request);
  const input = await parseJsonBody(request, productUpdateSchema);
  if (input.status !== undefined && !hasPermission(context, PERMISSION.PRODUCTS.ACTIVATE)) throw errors.forbidden();
  const product = await CatalogService.updateProduct(await productId(params), input, context.user._id, getAuditRequestContext(request));
  return apiSuccess({ id: String(product._id), status: product.status });
});
