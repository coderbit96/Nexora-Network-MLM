import { PERMISSION } from "@/config/permissions";
import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { hasPermission, requireAuth, requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { createStaffSchema } from "@/lib/validation/staff";
import { parseJsonBody } from "@/lib/validation/request";
import { Role, User } from "@/models";
import { getAuditRequestContext } from "@/services/audit/audit-service";
import { canCreateStaff, canDisableStaff, canEditStaff, canManageStaffTarget } from "@/services/auth/staff-authorization";
import { StaffService } from "@/services/auth/staff-service";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseListFilters(url: URL) {
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const sort: 1 | -1 = url.searchParams.get("sort") === "oldest" ? 1 : -1;
  const status = url.searchParams.get("status")?.trim();
  const search = url.searchParams.get("q")?.trim().slice(0, 100);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) {
    throw errors.badRequest("Invalid pagination.");
  }
  if (status && !["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) throw errors.badRequest("Invalid staff status.");
  return { page, limit, sort, ...(status ? { status } : {}), ...(search ? { search } : {}) };
}

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requirePermission(PERMISSION.STAFF.VIEW, request);
  const input = parseListFilters(new URL(request.url));
  const skip = (input.page - 1) * input.limit;
  const staffRoleIds = (await Role.find({ baseRole: { $in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } }).select("_id").lean()).map((role) => role._id);
  const query = {
    roleIds: { $in: staffRoleIds },
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { $or: [{ displayName: new RegExp(escapeRegex(input.search), "i") }, { email: new RegExp(escapeRegex(input.search), "i") }] } : {}),
  };
  const [rows, total, assignableRoles] = await Promise.all([
    User.find(query).sort({ createdAt: input.sort, _id: input.sort }).skip(skip).limit(input.limit).populate("roleIds", "name slug baseRole").lean(),
    User.countDocuments(query),
    StaffService.listAssignableRoles(context),
  ]);
  return apiSuccess({
    items: rows.map((row) => ({
      id: String(row._id),
      name: row.displayName,
      email: row.email,
      status: row.status,
      roles: (row.roleIds as unknown as Array<{ id?: string; _id: { toString(): string }; name: string; slug: string; baseRole: string }>).map((role) => ({ id: String(role._id), name: role.name, slug: role.slug, baseRole: role.baseRole })),
      createdAt: row.createdAt.toISOString(),
      canManage: canManageStaffTarget(context, context.userId, String(row._id), row.roleIds as unknown as Array<{ baseRole: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "MEMBER" }>),
    })),
    pagination: { total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
    capabilities: {
      canCreate: canCreateStaff(context),
      canEdit: canEditStaff(context),
      canDisable: canDisableStaff(context),
      canAssignRoles: hasPermission(context, PERMISSION.ROLES.ASSIGN),
    },
    assignableRoles: assignableRoles.map((role) => ({ id: String(role._id), name: role.name, slug: role.slug, baseRole: role.baseRole })),
  });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  enforceRateLimit(`admin-staff-create:${context.userId}`, 10, 60_000);
  const input = await parseJsonBody(request, createStaffSchema);
  const result = await StaffService.create(input, context, { actorUserId: context.user._id, ...getAuditRequestContext(request) });
  return apiSuccess(result, { status: 201 });
});
