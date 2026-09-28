import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { Category, Product } from "@/models";

test("product schema validates sale pricing, stock, image URLs, and catalogue fields", async () => {
  const product = new Product({ categoryId: new Types.ObjectId(), name: "Wellness Pack", slug: "wellness-pack", sku: "WELL-001", shortDescription: "A concise description", description: "A full description", imageUrls: ["https://cdn.example.test/wellness.jpg"], priceMinor: 1_000n, salePriceMinor: 1_200n, currency: "INR", pv: 10n, bv: 20n, stockQuantity: -1, commissionEligible: true, featured: true, status: "ACTIVE" });
  await assert.rejects(product.validate(), /Sale price cannot exceed|Stock/);
});

test("catalogue keeps slug and SKU uniqueness indexes", () => {
  const indexes = Product.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  assert.equal(indexes.some(([keys, options]) => "sku" in keys && options.unique === true), true);
  assert.equal(indexes.some(([keys, options]) => "slug" in keys && options.unique === true), true);
  const categoryIndexes = Category.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  assert.equal(categoryIndexes.some(([keys, options]) => "slug" in keys && options.unique === true), true);
});

test("product images reject insecure HTTP URLs", async () => {
  const product = new Product({ categoryId: new Types.ObjectId(), name: "Secure image product", slug: "secure-image-product", sku: "IMG-001", imageUrls: ["http://cdn.example.test/product.jpg"], priceMinor: 1_000n, currency: "INR", pv: 0n, bv: 0n, stockQuantity: 1, commissionEligible: false, featured: false, status: "ACTIVE" });
  await assert.rejects(product.validate(), /HTTPS image URLs/);
});
