import "server-only";

import { Types } from "mongoose";

import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";
import { errors } from "@/lib/errors/app-error";
import { Category, Product } from "@/models";
import type { IProduct } from "@/types/domain";
import { serializeProduct } from "@/services/catalog/catalog-query";

type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
type StockFilter = "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK";
export type ProductManagementFilters = { page: number; limit: number; query?: string; categoryId?: Types.ObjectId; status?: ProductStatus; stock?: StockFilter; commissionEligible?: boolean };
const PRODUCT_STATUSES: readonly ProductStatus[] = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"];
const STOCK_FILTERS: readonly StockFilter[] = ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK"];
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseProductManagementFilters(params: URLSearchParams): ProductManagementFilters {
  const numeric = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const page = numeric(params.get("page"), 1); const limit = numeric(params.get("limit"), 25);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid product pagination.");
  const query = params.get("q")?.trim().slice(0, 100) || undefined;
  const category = params.get("category")?.trim(); const status = params.get("status")?.trim(); const stock = params.get("stock")?.trim(); const eligible = params.get("commissionEligible");
  if (category && !Types.ObjectId.isValid(category)) throw errors.badRequest("Invalid category filter.");
  if (status && !PRODUCT_STATUSES.includes(status as ProductStatus)) throw errors.badRequest("Invalid product status.");
  if (stock && !STOCK_FILTERS.includes(stock as StockFilter)) throw errors.badRequest("Invalid stock filter.");
  if (eligible !== null && eligible !== "true" && eligible !== "false") throw errors.badRequest("Invalid commission eligibility filter.");
  return { page, limit, ...(query ? { query } : {}), ...(category ? { categoryId: new Types.ObjectId(category) } : {}), ...(status ? { status: status as ProductStatus } : {}), ...(stock ? { stock: stock as StockFilter } : {}), ...(eligible !== null ? { commissionEligible: eligible === "true" } : {}) };
}

function serializeManagementProduct(product: IProduct & { _id: Types.ObjectId }, category?: { name: string; slug: string } | null) {
  return { ...serializeProduct(product, category), status: product.status };
}

export async function getProductManagementPage(filters: ProductManagementFilters) {
  const regex = filters.query ? new RegExp(escapeRegex(filters.query), "i") : undefined;
  const stock = filters.stock === "IN_STOCK" ? { $gt: 0 } : filters.stock === "OUT_OF_STOCK" ? 0 : filters.stock === "LOW_STOCK" ? { $gte: 1, $lte: 10 } : undefined;
  const query = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}), ...(filters.status ? { status: filters.status } : {}),
    ...(filters.commissionEligible !== undefined ? { commissionEligible: filters.commissionEligible } : {}), ...(stock !== undefined ? { stockQuantity: stock } : {}),
    ...(regex ? { $or: [{ name: regex }, { slug: regex }, { sku: regex }, { shortDescription: regex }] } : {}),
  };
  const [products, total, categories] = await Promise.all([
    Product.find(query).sort({ updatedAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Product.countDocuments(query), Category.find().select("name slug status").sort({ name: 1 }).lean(),
  ]);
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  return {
    products: products.map((product) => serializeManagementProduct(product, categoryById.get(String(product.categoryId)))),
    categories: categories.map((category) => ({ id: String(category._id), name: category.name, slug: category.slug, status: category.status })),
    pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}

export async function getProductManagementDetail(id: string) {
  if (!Types.ObjectId.isValid(id)) throw errors.notFound("Product was not found.");
  const product = await Product.findById(id).lean();
  if (!product) throw errors.notFound("Product was not found.");
  const [category, categories] = await Promise.all([
    Category.findById(product.categoryId).select("name slug").lean(),
    Category.find().select("name slug status").sort({ name: 1 }).lean(),
  ]);
  return { product: serializeManagementProduct(product, category), categories: categories.map((item) => ({ id: String(item._id), name: item.name, slug: item.slug, status: item.status })) };
}

export async function getProductFormData() {
  const categories = await Category.find({ status: "ACTIVE" }).select("name slug").sort({ name: 1 }).lean();
  return { categories: categories.map((category) => ({ id: String(category._id), name: category.name, slug: category.slug })) };
}
