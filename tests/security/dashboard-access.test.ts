import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION } from "@/config/permissions";
import { scopeDashboard } from "@/services/dashboard/dashboard-access";
import type { AdminDashboardData } from "@/services/dashboard/admin-dashboard";

const data: AdminDashboardData = {
  range: { key: "today", label: "Today", from: "2026-09-29", to: "2026-09-30" }, currency: "INR",
  metrics: { totalMembers: 2, activeMembers: 2, newMembers: 1, totalSalesMinor: "12345", commissionPaidMinor: "100", pendingCommissions: 1, pendingCommissionMinor: "50", walletLiabilityMinor: "1000", pendingWithdrawalsMinor: "300", completedWithdrawalsMinor: "200", orders: 1 },
  charts: { memberGrowth: [{ label: "Today", count: 1 }], salesTrend: [{ label: "Today", amountMinor: "12345" }], commissionTrend: [{ label: "Today", amountMinor: "100" }], withdrawalTrend: [{ label: "Today", amountMinor: "200" }] },
  recentMembers: [{ id: "member", memberNumber: "MLM000001", name: "Private Member", status: "ACTIVE", joinedAt: "2026-09-29" }], pendingWithdrawals: [], recentOrders: [], recentCommissions: [],
  securityActivity: [{ id: "audit", action: "role.updated", resourceType: "Role", actorName: "Owner", createdAt: "2026-09-29" }],
};

test("dashboard access alone never discloses financials, private members, or audit data", () => {
  const scoped = scopeDashboard(data, { status: "ACTIVE", roles: ["STAFF"], permissions: [PERMISSION.DASHBOARD.VIEW] });
  assert.equal(scoped.metrics.walletLiabilityMinor, undefined);
  assert.equal(scoped.metrics.totalSalesMinor, undefined);
  assert.equal(scoped.metrics.totalMembers, 2);
  assert.deepEqual(scoped.charts.salesTrend, []);
  assert.deepEqual(scoped.recentMembers, []);
  assert.deepEqual(scoped.securityActivity, []);
  assert.equal(JSON.stringify(scoped).includes("Private Member"), false);
  const sales = scopeDashboard(data, { status: "ACTIVE", roles: ["STAFF"], permissions: [PERMISSION.DASHBOARD.VIEW, PERMISSION.DASHBOARD.SALES] });
  assert.equal(sales.metrics.totalSalesMinor, "12345");
  assert.equal(sales.metrics.walletLiabilityMinor, undefined);
  const owner = scopeDashboard(data, { status: "ACTIVE", roles: ["SUPER_ADMIN"], permissions: [] });
  assert.deepEqual(owner.metrics, data.metrics);
  assert.deepEqual(owner.securityActivity, data.securityActivity);
});
