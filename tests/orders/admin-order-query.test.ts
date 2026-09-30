import assert from "node:assert/strict";
import test from "node:test";

import { parseAdminOrderFilters } from "@/services/orders/admin-order-query";

test("admin order filters accept bounded member and exact order identifiers", () => {
  const filters = parseAdminOrderFilters(new URLSearchParams({ page: "2", limit: "25", member: "MLM000123", order: "507f1f77bcf86cd799439011" }));

  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 25);
  assert.equal(filters.member, "MLM000123");
  assert.equal(String(filters.orderId), "507f1f77bcf86cd799439011");
});

test("admin order filters reject malformed identifiers and ignore query-shaped member keys", () => {
  assert.throws(() => parseAdminOrderFilters(new URLSearchParams("order=not-an-object-id")));
  assert.throws(() => parseAdminOrderFilters(new URLSearchParams("status=$ne")));

  const filters = parseAdminOrderFilters(new URLSearchParams("member%5B%24ne%5D=anything"));
  assert.equal(filters.member, undefined);
});
