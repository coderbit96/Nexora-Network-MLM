import { Types } from "mongoose";

import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { productUpdateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

const id = async (params: Promise<{ id: string }>) => { const value = (await params).id; if (!Types.ObjectId.isValid(value)) throw errors.badRequest("Invalid product identifier."); return value; };
export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const context = await requirePermission(PERMISSION.PRODUCTS.EDIT, request); const product = await CatalogService.updateProduct(await id(params), await parseJsonBody(request, productUpdateSchema), context.user._id, getAuditRequestContext(request)); return apiSuccess({ id: String(product._id) }); });
export const DELETE = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const context = await requirePermission(PERMISSION.PRODUCTS.DELETE, request); await CatalogService.archiveProduct(await id(params), context.user._id, getAuditRequestContext(request)); return apiSuccess({ archived: true }); });
