import assert from "node:assert/strict";
import test from "node:test";

import { parseRoleListFilters } from "@/services/auth/role-management-query";

test("role list filters are bounded and accept supported role statuses", () => {
  const filters = parseRoleListFilters(new URLSearchParams({ page: "2", limit: "50", q: "Finance Manager", status: "INACTIVE" }));
  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 50);
  assert.equal(filters.query, "Finance Manager");
  assert.equal(filters.status, "INACTIVE");
});

test("role list filters reject unsafe pagination and unknown statuses", () => {
  assert.throws(() => parseRoleListFilters(new URLSearchParams({ page: "0" })), /Invalid role pagination/);
  assert.throws(() => parseRoleListFilters(new URLSearchParams({ status: "DELETED" })), /Invalid role status/);
});
