import "server-only";

import { errors } from "@/lib/errors/app-error";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";
import { Category, Product } from "@/models";

type CategoryStatus = "ACTIVE" | "INACTIVE";
export type CategoryManagementFilters = { page: number; limit: number; query?: string; status?: CategoryStatus };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Bounded primitive filters for the category administration list. */
export function parseCategoryManagementFilters(params: URLSearchParams): CategoryManagementFilters {
  const numeric = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const page = numeric(params.get("page"), 1); const limit = numeric(params.get("limit"), 25);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid category pagination.");
  const query = params.get("q")?.trim().slice(0, 100) || undefined;
  const status = params.get("status")?.trim() || undefined;
  if (status && status !== "ACTIVE" && status !== "INACTIVE") throw errors.badRequest("Invalid category status.");
  return { page, limit, ...(query ? { query } : {}), ...(status ? { status: status as CategoryStatus } : {}) };
}

export async function getCategoryManagementPage(filters: CategoryManagementFilters) {
  const regex = filters.query ? new RegExp(escapeRegex(filters.query), "i") : undefined;
  const query = { ...(filters.status ? { status: filters.status } : {}), ...(regex ? { $or: [{ name: regex }, { slug: regex }, { description: regex }] } : {}) };
  const [categories, total] = await Promise.all([
    Category.find(query).sort({ name: 1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Category.countDocuments(query),
  ]);
  const categoryIds = categories.map((category) => category._id);
  const productCounts = categoryIds.length ? await Product.aggregate<{ _id: unknown; count: number }>([{ $match: { categoryId: { $in: categoryIds } } }, { $group: { _id: "$categoryId", count: { $sum: 1 } } }]) : [];
  const countById = new Map(productCounts.map((entry) => [String(entry._id), entry.count]));
  return {
    categories: categories.map((category) => ({ id: String(category._id), name: category.name, slug: category.slug, description: category.description ?? "", status: category.status, productCount: countById.get(String(category._id)) ?? 0, createdAt: category.createdAt.toISOString(), updatedAt: category.updatedAt.toISOString() })),
    pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}
