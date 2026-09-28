import { type Model, model, models, Schema } from "mongoose";

import type { IProduct } from "@/types/domain";
import { nonNegativeBigInt, schemaOptions } from "./model-utils";

const ProductSchema = new Schema<IProduct>({
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  sku: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z0-9][A-Z0-9_-]{2,63}$/ },
  shortDescription: { type: String, trim: true, maxlength: 360 },
  description: { type: String, trim: true, maxlength: 10_000 },
  imageUrls: { type: [String], default: [], validate: { validator: (value: string[]) => value.length <= 8 && value.every((item) => /^https:\/\/\S+$/i.test(item)), message: "Provide up to eight valid HTTPS image URLs." } },
  priceMinor: { type: Schema.Types.BigInt, required: true, validate: { validator: nonNegativeBigInt, message: "Price cannot be negative." } },
  salePriceMinor: { type: Schema.Types.BigInt, validate: { validator: nonNegativeBigInt, message: "Sale price cannot be negative." } },
  currency: { type: String, required: true, trim: true, uppercase: true, default: "INR", match: /^[A-Z]{3}$/ },
  pv: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "PV cannot be negative." } },
  bv: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "BV cannot be negative." } },
  stockQuantity: { type: Number, required: true, default: 0, min: 0, validate: { validator: Number.isSafeInteger, message: "Stock must be a whole number." } },
  commissionEligible: { type: Boolean, required: true, default: true },
  featured: { type: Boolean, required: true, default: false, index: true },
  status: { type: String, required: true, enum: ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"], default: "DRAFT", index: true },
}, schemaOptions);
ProductSchema.index({ sku: 1 }, { unique: true });
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ categoryId: 1, status: 1, createdAt: -1 });
ProductSchema.index({ status: 1, featured: -1, createdAt: -1 });
ProductSchema.index({ status: 1, priceMinor: 1 });
ProductSchema.index({ name: "text", description: "text" });
ProductSchema.pre("validate", function () {
  if (this.salePriceMinor != null && this.salePriceMinor > this.priceMinor) this.invalidate("salePriceMinor", "Sale price cannot exceed the regular price.");
});
export const Product: Model<IProduct> = (models.Product as Model<IProduct>) || model<IProduct>("Product", ProductSchema);
