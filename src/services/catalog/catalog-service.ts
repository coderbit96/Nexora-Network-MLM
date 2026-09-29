import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { decimalToMinorUnits } from "@/lib/money/minor-units";
import { Category, Product } from "@/models";
import type { IProduct } from "@/types/domain";
import { SystemSettingsService } from "@/services/settings/system-settings-service";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";

type CategoryInput = { name: string; slug: string; description?: string; status: "ACTIVE" | "INACTIVE" };
type ProductInput = { categoryId: string; name: string; slug: string; sku: string; shortDescription?: string; description?: string; imageUrls: string[]; price: string; salePrice?: string; pv: string; bv: string; stockQuantity: number; commissionEligible: boolean; featured: boolean; status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED" };

function duplicate(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000; }
function optionalText(value?: string) { return value?.trim() || undefined; }

/** Safe, compact commercial fields retained in the audit trail for future product changes. */
function productAuditSummary(product: Pick<IProduct, "name" | "slug" | "sku" | "categoryId" | "status" | "priceMinor" | "salePriceMinor" | "pv" | "bv" | "stockQuantity" | "commissionEligible" | "featured">) {
  return {
    name: product.name, slug: product.slug, sku: product.sku, categoryId: String(product.categoryId), status: product.status,
    priceMinor: product.priceMinor.toString(), ...(product.salePriceMinor != null ? { salePriceMinor: product.salePriceMinor.toString() } : {}),
    pv: product.pv.toString(), bv: product.bv.toString(), stockQuantity: product.stockQuantity, commissionEligible: product.commissionEligible, featured: product.featured,
  };
}

function productValues(input: ProductInput, currency: string) {
  const priceMinor = decimalToMinorUnits(input.price); const salePriceMinor = input.salePrice ? decimalToMinorUnits(input.salePrice) : undefined;
  if (salePriceMinor != null && salePriceMinor > priceMinor) throw errors.badRequest("Sale price cannot exceed regular price.");
  return { categoryId: new Types.ObjectId(input.categoryId), name: input.name.trim(), slug: input.slug.trim().toLowerCase(), sku: input.sku.trim().toUpperCase(), ...(optionalText(input.shortDescription) ? { shortDescription: optionalText(input.shortDescription) } : {}), ...(optionalText(input.description) ? { description: optionalText(input.description) } : {}), imageUrls: input.imageUrls, priceMinor, ...(salePriceMinor != null ? { salePriceMinor } : { salePriceMinor: undefined }), currency, pv: BigInt(input.pv), bv: BigInt(input.bv), stockQuantity: input.stockQuantity, commissionEligible: input.commissionEligible, featured: input.featured, status: input.status };
}

async function ensureCategory(categoryId: Types.ObjectId, productStatus: IProduct["status"]) {
  const category = await Category.findById(categoryId).lean();
  if (!category) throw errors.badRequest("Select a valid category.");
  if (productStatus === "ACTIVE" && category.status !== "ACTIVE") throw errors.badRequest("An active product requires an active category.");
}

export class CatalogService {
  static async createCategory(input: CategoryInput, actorUserId: Types.ObjectId, audit?: AuditRequestContext) {
    await connectToDatabase();
    try {
      const category = await Category.create({ name: input.name.trim(), slug: input.slug.trim().toLowerCase(), ...(optionalText(input.description) ? { description: optionalText(input.description) } : {}), status: input.status });
      await AuditService.record({ actorUserId, action: "catalog.category_created", resourceType: "Category", resourceId: String(category._id), ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), after: { name: category.name, slug: category.slug, description: category.description, status: category.status } });
      return category;
    } catch (error) { if (duplicate(error)) throw errors.conflict("A category with this slug already exists."); throw error; }
  }

  static async updateCategory(id: string, input: Partial<CategoryInput>, actorUserId: Types.ObjectId, audit?: AuditRequestContext) {
    await connectToDatabase(); const category = await Category.findById(id); if (!category) throw errors.notFound("Category was not found.");
    const before = { name: category.name, slug: category.slug, description: category.description, status: category.status };
    if (input.name !== undefined) category.name = input.name.trim(); if (input.slug !== undefined) category.slug = input.slug.trim().toLowerCase(); if (input.description !== undefined) category.description = optionalText(input.description); if (input.status !== undefined) category.status = input.status;
    try { await category.save(); } catch (error) { if (duplicate(error)) throw errors.conflict("A category with this slug already exists."); throw error; }
    await AuditService.record({ actorUserId, action: "catalog.category_updated", resourceType: "Category", resourceId: id, ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), before, after: { name: category.name, slug: category.slug, description: category.description, status: category.status } }); return category;
  }

  static async deleteCategory(id: string, actorUserId: Types.ObjectId, audit?: AuditRequestContext) {
    await connectToDatabase(); const category = await Category.findById(id); if (!category) throw errors.notFound("Category was not found.");
    if (await Product.exists({ categoryId: category._id })) throw errors.conflict("Archive or reassign products before deleting this category.");
    await category.deleteOne(); await AuditService.record({ actorUserId, action: "catalog.category_deleted", resourceType: "Category", resourceId: id, ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), before: { name: category.name, slug: category.slug } });
  }

  static async createProduct(input: ProductInput, actorUserId: Types.ObjectId, audit?: AuditRequestContext) {
    await connectToDatabase(); const configuration = await SystemSettingsService.read(); const values = productValues(input, configuration.settings.currency); await ensureCategory(values.categoryId, values.status);
    try {
      const product = await Product.create(values);
      await AuditService.record({ actorUserId, action: "catalog.product_created", resourceType: "Product", resourceId: String(product._id), ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), after: productAuditSummary(product) }); return product;
    } catch (error) { if (duplicate(error)) throw errors.conflict("A product with this slug or SKU already exists."); throw error; }
  }

  static async updateProduct(id: string, input: Partial<ProductInput>, actorUserId: Types.ObjectId, audit?: AuditRequestContext) {
    await connectToDatabase(); const product = await Product.findById(id); if (!product) throw errors.notFound("Product was not found.");
    const merged: ProductInput = { categoryId: input.categoryId ?? String(product.categoryId), name: input.name ?? product.name, slug: input.slug ?? product.slug, sku: input.sku ?? product.sku, shortDescription: input.shortDescription ?? product.shortDescription, description: input.description ?? product.description, imageUrls: input.imageUrls ?? product.imageUrls, price: input.price ?? `${product.priceMinor / 100n}.${(product.priceMinor % 100n).toString().padStart(2, "0")}`, salePrice: input.salePrice === "" ? undefined : input.salePrice ?? (product.salePriceMinor != null ? `${product.salePriceMinor / 100n}.${(product.salePriceMinor % 100n).toString().padStart(2, "0")}` : undefined), pv: input.pv ?? product.pv.toString(), bv: input.bv ?? product.bv.toString(), stockQuantity: input.stockQuantity ?? product.stockQuantity, commissionEligible: input.commissionEligible ?? product.commissionEligible, featured: input.featured ?? product.featured, status: input.status ?? product.status };
    const values = productValues(merged, product.currency); await ensureCategory(values.categoryId, values.status);
    const before = productAuditSummary(product);
    product.set(values); try { await product.save(); } catch (error) { if (duplicate(error)) throw errors.conflict("A product with this slug or SKU already exists."); throw error; }
    await AuditService.record({ actorUserId, action: "catalog.product_updated", resourceType: "Product", resourceId: id, ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), before, after: productAuditSummary(product) }); return product;
  }

  static async archiveProduct(id: string, actorUserId: Types.ObjectId, audit?: AuditRequestContext) {
    await connectToDatabase(); const product = await Product.findById(id); if (!product) throw errors.notFound("Product was not found."); const before = product.status; product.status = "ARCHIVED"; product.featured = false; await product.save(); await AuditService.record({ actorUserId, action: "catalog.product_archived", resourceType: "Product", resourceId: id, ...(audit?.ipAddress ? { ipAddress: audit.ipAddress } : {}), ...(audit?.userAgent ? { userAgent: audit.userAgent } : {}), before: { status: before }, after: { status: product.status } });
  }
}
