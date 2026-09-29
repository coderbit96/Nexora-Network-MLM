import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { parseProductManagementFilters } from "@/services/catalog/product-management-query";

test("product management filters accept bounded, typed server-side values", () => {
  const categoryId = new Types.ObjectId();
  const filters = parseProductManagementFilters(new URLSearchParams({
    page: "2", limit: "50", q: "Wellness Pack", category: String(categoryId), status: "ACTIVE", stock: "LOW_STOCK", commissionEligible: "true",
  }));

  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 50);
  assert.equal(filters.query, "Wellness Pack");
  assert.equal(String(filters.categoryId), String(categoryId));
  assert.equal(filters.status, "ACTIVE");
  assert.equal(filters.stock, "LOW_STOCK");
  assert.equal(filters.commissionEligible, true);
});

test("product management filters reject invalid pagination and query values", () => {
  assert.throws(() => parseProductManagementFilters(new URLSearchParams({ page: "0" })), /Invalid product pagination/);
  assert.throws(() => parseProductManagementFilters(new URLSearchParams({ category: "not-an-id" })), /Invalid category filter/);
  assert.throws(() => parseProductManagementFilters(new URLSearchParams({ status: "DELETED" })), /Invalid product status/);
  assert.throws(() => parseProductManagementFilters(new URLSearchParams({ commissionEligible: "1" })), /Invalid commission eligibility filter/);
});
