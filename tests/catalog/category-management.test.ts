import assert from "node:assert/strict";
import test from "node:test";

import { parseCategoryManagementFilters } from "@/services/catalog/category-management-query";

test("category management filters support bounded search, status, and pagination", () => {
  const filters = parseCategoryManagementFilters(new URLSearchParams({ page: "2", limit: "25", q: "wellness", status: "ACTIVE" }));
  assert.deepEqual(filters, { page: 2, limit: 25, query: "wellness", status: "ACTIVE" });
});

test("category management filters reject unsafe pagination and unsupported status values", () => {
  assert.throws(() => parseCategoryManagementFilters(new URLSearchParams({ page: "0" })));
  assert.throws(() => parseCategoryManagementFilters(new URLSearchParams({ limit: "101" })));
  assert.throws(() => parseCategoryManagementFilters(new URLSearchParams({ status: "$ne" })));
});
