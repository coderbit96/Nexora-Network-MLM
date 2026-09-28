import { Types } from "mongoose";

import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { categoryUpdateSchema } from "@/lib/validation/catalog";
import { parseJsonBody } from "@/lib/validation/request";
import { CatalogService } from "@/services/catalog/catalog-service";
import { getAuditRequestContext } from "@/services/audit/audit-service";

const id = async (params: Promise<{ id: string }>) => { const value = (await params).id; if (!Types.ObjectId.isValid(value)) throw errors.badRequest("Invalid category identifier."); return value; };
export const PATCH = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const context = await requirePermission(PERMISSION.CATEGORIES.MANAGE, request); const category = await CatalogService.updateCategory(await id(params), await parseJsonBody(request, categoryUpdateSchema), context.user._id, getAuditRequestContext(request)); return apiSuccess({ id: String(category._id) }); });
export const DELETE = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => { const context = await requirePermission(PERMISSION.CATEGORIES.MANAGE, request); await CatalogService.deleteCategory(await id(params), context.user._id, getAuditRequestContext(request)); return apiSuccess({ deleted: true }); });
