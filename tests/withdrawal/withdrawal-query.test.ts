import assert from "node:assert/strict";
import test from "node:test";

import { parseWithdrawalFilters } from "@/services/withdrawal/withdrawal-query";

test("withdrawal filters accept only bounded primitive member and status values", () => {
  const filters = parseWithdrawalFilters(new URLSearchParams({ page: "2", limit: "25", status: "PROCESSING", member: "MLM000123" }));

  assert.deepEqual(filters, { page: 2, limit: 25, status: "PROCESSING", member: "MLM000123" });
});

test("withdrawal filters reject invalid status and ignore query-operator shaped keys", () => {
  assert.throws(() => parseWithdrawalFilters(new URLSearchParams("status=$ne")));
  assert.throws(() => parseWithdrawalFilters(new URLSearchParams("page=0")));

  const filters = parseWithdrawalFilters(new URLSearchParams("member%5B%24ne%5D=anything"));
  assert.equal(filters.member, undefined);
});
