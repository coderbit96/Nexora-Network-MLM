import "server-only";

import { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Category, Product } from "@/models";
import type { IProduct } from "@/types/domain";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";

export type CatalogFilters = { category?: string; search?: string; sort: "newest" | "price_asc" | "price_desc" | "name"; page: number; limit: number };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const category = params.get("category")?.trim().toLowerCase() || undefined; const search = params.get("q")?.trim().slice(0, 100) || undefined;
  const sort = params.get("sort") || "newest"; if (!(["newest", "price_asc", "price_desc", "name"] as string[]).includes(sort)) throw errors.badRequest("Invalid product sorting option.");
  const asNumber = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN; const page = asNumber(params.get("page"), 1); const limit = asNumber(params.get("limit"), 12);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 48) throw errors.badRequest("Invalid product pagination.");
  return { ...(category ? { category } : {}), ...(search ? { search } : {}), sort: sort as CatalogFilters["sort"], page, limit };
}

export async function publicCategories() { await connectToDatabase(); return Category.find({ status: "ACTIVE" }).sort({ name: 1 }).lean(); }

export async function publicProducts(filters: CatalogFilters) {
  await connectToDatabase();
  const categories = await Category.find({ status: "ACTIVE", ...(filters.category ? { slug: filters.category } : {}) }).select("name slug").lean();
  if (!categories.length) return { products: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 1 };
  const query = { status: "ACTIVE", categoryId: { $in: categories.map((category) => category._id) }, ...(filters.search ? { $or: [{ name: { $regex: escapeRegex(filters.search), $options: "i" } }, { shortDescription: { $regex: escapeRegex(filters.search), $options: "i" } }, { sku: { $regex: escapeRegex(filters.search), $options: "i" } }] } : {}) };
  const sort: Array<[string, 1 | -1]> = filters.sort === "price_asc" ? [["salePriceMinor", 1], ["priceMinor", 1]] : filters.sort === "price_desc" ? [["salePriceMinor", -1], ["priceMinor", -1]] : filters.sort === "name" ? [["name", 1]] : [["featured", -1], ["createdAt", -1]];
  const [products, total] = await Promise.all([Product.find(query).sort(sort).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(), Product.countDocuments(query)]);
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  return { products: products.map((product) => serializeProduct(product, categoryById.get(String(product.categoryId)))), total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) };
}

export async function publicProductBySlug(slug: string) {
  await connectToDatabase();
  const product = await Product.findOne({ slug: slug.toLowerCase(), status: "ACTIVE" }).lean(); if (!product) throw errors.notFound("Product was not found."); const category = await Category.findOne({ _id: product.categoryId, status: "ACTIVE" }).select("name slug").lean(); if (!category) throw errors.notFound("Product was not found."); return serializeProduct(product, category);
}

export function serializeProduct(product: IProduct & { _id: Types.ObjectId }, category?: { name: string; slug: string } | null) {
  return { id: String(product._id), name: product.name, slug: product.slug, sku: product.sku, shortDescription: product.shortDescription ?? "", description: product.description ?? "", imageUrls: product.imageUrls, priceMinor: product.priceMinor.toString(), ...(product.salePriceMinor != null ? { salePriceMinor: product.salePriceMinor.toString() } : {}), currency: product.currency, pv: product.pv.toString(), bv: product.bv.toString(), stockQuantity: product.stockQuantity, inStock: product.stockQuantity > 0, commissionEligible: product.commissionEligible, featured: product.featured, category: category ? { name: category.name, slug: category.slug } : null, createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString() };
}

export async function adminProducts(filters: CatalogFilters) {
  await connectToDatabase();
  const query = { ...(filters.category ? { categoryId: (await Category.findOne({ slug: filters.category }).select("_id").lean())?._id } : {}), ...(filters.search ? { $or: [{ name: { $regex: escapeRegex(filters.search), $options: "i" } }, { sku: { $regex: escapeRegex(filters.search), $options: "i" } }] } : {}) };
  const [products, total, categories] = await Promise.all([Product.find(query).sort({ createdAt: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(), Product.countDocuments(query), Category.find().sort({ name: 1 }).lean()]);
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  return { products: products.map((product) => ({ ...serializeProduct(product, categoryById.get(String(product.categoryId))), status: product.status })), total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) };
}
