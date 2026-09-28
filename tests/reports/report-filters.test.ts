import assert from "node:assert/strict";
import test from "node:test";

import { parseReportFilters, REPORT_NAMES } from "../../src/services/reports/report-service";

test("report filters bound pagination and normalize member filters", () => {
  const filters = parseReportFilters(new URLSearchParams({ page: "2", limit: "25", member: "mlm000001", status: "completed", from: "2026-01-01", to: "2026-01-31" }));
  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 25);
  assert.equal(filters.memberNumber, "MLM000001");
  assert.equal(filters.status, "COMPLETED");
  assert.equal(filters.from?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(filters.toExclusive?.toISOString(), "2026-02-01T00:00:00.000Z");
});

test("report filters reject unsafe pagination, member IDs, and inverted date ranges", () => {
  assert.throws(() => parseReportFilters(new URLSearchParams({ limit: "1000" })));
  assert.throws(() => parseReportFilters(new URLSearchParams({ member: "not-a-member" })));
  assert.throws(() => parseReportFilters(new URLSearchParams({ from: "2026-02-01", to: "2026-01-01" })));
});

test("the report catalogue exposes the required operational reports", () => {
  assert.deepEqual(REPORT_NAMES, ["members", "referrals", "commissions", "wallet-transactions", "withdrawals", "sales", "orders"]);
});
