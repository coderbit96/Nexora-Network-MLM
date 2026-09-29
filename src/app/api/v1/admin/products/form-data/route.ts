import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requireAnyPermission } from "@/lib/auth/authorization";
import { getProductFormData } from "@/services/catalog/product-management-query";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAnyPermission([PERMISSION.PRODUCTS.CREATE, PERMISSION.PRODUCTS.EDIT], request);
  return apiSuccess({
    ...(await getProductFormData()),
    capabilities: {
      create: hasPermission(context, PERMISSION.PRODUCTS.CREATE),
      edit: hasPermission(context, PERMISSION.PRODUCTS.EDIT),
      activate: hasPermission(context, PERMISSION.PRODUCTS.ACTIVATE),
    },
  });
});
