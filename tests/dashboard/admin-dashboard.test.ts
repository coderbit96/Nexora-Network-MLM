import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog, CommissionTransaction, MemberProfile, Order, Payment, Withdrawal } from "@/models";
import { parseAdminDashboardRange, type AdminDashboardData } from "@/services/dashboard/admin-dashboard";

function hasIndex(model: { schema: { indexes(): Array<[Record<string, 1 | -1>, Record<string, unknown>]> } }, fields: string[]) {
  return model.schema.indexes().some(([keys]) => fields.every((field) => field in keys));
}

test("admin dashboard time-series queries have supporting indexes", () => {
  assert.equal(hasIndex(MemberProfile, ["createdAt"]), true);
  assert.equal(hasIndex(Order, ["paymentStatus", "paidAt"]), true);
  assert.equal(hasIndex(CommissionTransaction, ["status", "createdAt"]), true);
  assert.equal(hasIndex(Withdrawal, ["status", "completedAt"]), true);
  assert.equal(hasIndex(Payment, ["status", "updatedAt"]), true);
  assert.equal(hasIndex(AuditLog, ["createdAt"]), true);
});

test("dashboard range parser creates bounded ranges and rejects an oversized custom range", () => {
  const range = parseAdminDashboardRange(new URLSearchParams({ range: "custom", from: "2026-01-01", to: "2026-01-31" }));
  assert.equal(range.key, "custom");
  assert.equal(range.start.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-02-01T00:00:00.000Z");
  assert.throws(() => parseAdminDashboardRange(new URLSearchParams({ range: "custom", from: "2025-01-01", to: "2026-02-01" })), /366 days/i);
});

test("dashboard response contract represents both empty and populated aggregation results", () => {
  const empty: AdminDashboardData = {
    range: { key: "today", label: "Today", from: "2026-09-29T00:00:00.000Z", to: "2026-09-29T12:00:00.000Z" }, currency: "INR",
    metrics: { totalMembers: 0, activeMembers: 0, newMembers: 0, previousNewMembers: 0, totalSalesMinor: "0", salesInRangeMinor: "0", totalCommissionMinor: "0", commissionInRangeMinor: "0", walletLiabilityMinor: "0", pendingWithdrawalCount: 0, pendingWithdrawalsMinor: "0", completedWithdrawalCount: 0, completedWithdrawalsMinor: "0", completedWithdrawalsInRangeMinor: "0", totalOrders: 0, ordersInRange: 0, successfulPayments: 0, successfulPaymentsInRange: 0 },
    charts: { memberGrowth: [{ label: "29 Sep", count: 0 }], salesTrend: [{ label: "29 Sep", amountMinor: "0" }], commissionTrend: [{ label: "29 Sep", amountMinor: "0" }], withdrawalTrend: [{ label: "29 Sep", amountMinor: "0" }] },
    recentMembers: [], pendingWithdrawals: [], recentOrders: [], recentPayments: [], recentCommissions: [], securityActivity: [],
  };
  assert.equal(empty.metrics.totalMembers, 0);
  assert.equal(empty.recentPayments.length, 0);

  const populated: AdminDashboardData = { ...empty, metrics: { ...empty.metrics, totalMembers: 2, totalSalesMinor: "25000", successfulPayments: 1 }, recentPayments: [{ id: "payment-1", orderNumber: "ORD00000001", memberName: "Ada Lovelace", memberNumber: "MLM000001", amountMinor: "25000", currency: "INR", provider: "provider", status: "SUCCESS", createdAt: "2026-09-29T10:00:00.000Z" }] };
  assert.equal(populated.metrics.successfulPayments, 1);
  assert.equal(populated.recentPayments[0]?.orderNumber, "ORD00000001");
});
