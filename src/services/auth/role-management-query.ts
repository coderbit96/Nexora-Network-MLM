import "server-only";

import { Types } from "mongoose";

import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";
import { errors } from "@/lib/errors/app-error";
import { Role, User } from "@/models";

type RoleStatus = "ACTIVE" | "INACTIVE";
export type RoleListFilters = { page: number; limit: number; query?: string; status?: RoleStatus };
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseRoleListFilters(params: URLSearchParams): RoleListFilters {
  const numeric = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const page = numeric(params.get("page"), 1); const limit = numeric(params.get("limit"), 25);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid role pagination.");
  const query = params.get("q")?.trim().slice(0, 100) || undefined;
  const status = params.get("status")?.trim();
  if (status && status !== "ACTIVE" && status !== "INACTIVE") throw errors.badRequest("Invalid role status.");
  return { page, limit, ...(query ? { query } : {}), ...(status ? { status: status as RoleStatus } : {}) };
}

function serializeRole(role: { _id: Types.ObjectId; name: string; slug: string; description?: string; baseRole: string; permissions: readonly string[]; isSystem: boolean; isActive: boolean; createdAt: Date }, userCount: number) {
  return { id: String(role._id), name: role.name, slug: role.slug, description: role.description ?? "", baseRole: role.baseRole, permissions: [...role.permissions], isSystem: role.isSystem, isActive: role.isActive, userCount, createdAt: role.createdAt.toISOString() };
}

async function getUserCounts(roleIds: Types.ObjectId[]) {
  if (!roleIds.length) return new Map<string, number>();
  const rows = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { roleIds: { $in: roleIds } } },
    { $unwind: "$roleIds" },
    { $match: { roleIds: { $in: roleIds } } },
    { $group: { _id: "$roleIds", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function getRoleManagementPage(filters: RoleListFilters) {
  const regex = filters.query ? new RegExp(escapeRegex(filters.query), "i") : undefined;
  const query = {
    ...(filters.status ? { isActive: filters.status === "ACTIVE" } : {}),
    ...(regex ? { $or: [{ name: regex }, { slug: regex }, { description: regex }, { baseRole: regex }] } : {}),
  };
  const [roles, total] = await Promise.all([
    Role.find(query).sort({ isSystem: -1, name: 1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Role.countDocuments(query),
  ]);
  const counts = await getUserCounts(roles.map((role) => role._id));
  return {
    items: roles.map((role) => serializeRole(role, counts.get(String(role._id)) ?? 0)),
    pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}

export async function getRoleManagementDetail(id: string) {
  if (!Types.ObjectId.isValid(id)) throw errors.notFound("Role was not found.");
  const role = await Role.findById(id).lean();
  if (!role) throw errors.notFound("Role was not found.");
  const counts = await getUserCounts([role._id]);
  return serializeRole(role, counts.get(String(role._id)) ?? 0);
}
