import { PERMISSION } from "@/config/permissions";
import { hasPermission, type AuthorizationSnapshot } from "@/lib/auth/policy";
import type { AdminDashboardData } from "./admin-dashboard";

export function dashboardAccess(actor: AuthorizationSnapshot) {
  return {
    finance: hasPermission(actor, PERMISSION.DASHBOARD.FINANCE),
    sales: hasPermission(actor, PERMISSION.DASHBOARD.SALES),
    members: hasPermission(actor, PERMISSION.MEMBERS.VIEW),
    withdrawals: hasPermission(actor, PERMISSION.WITHDRAWALS.VIEW_ALL),
    orders: hasPermission(actor, PERMISSION.ORDERS.VIEW_ALL),
    commissions: hasPermission(actor, PERMISSION.COMMISSIONS.VIEW_ALL),
    audit: hasPermission(actor, PERMISSION.AUDIT.VIEW),
  };
}

/** Strip restricted data before serialization, not just when rendering cards. */
export function scopeDashboard(data: AdminDashboardData, actor: AuthorizationSnapshot) {
  const access = dashboardAccess(actor);
  const metrics: Partial<AdminDashboardData["metrics"]> = { ...data.metrics };
  if (!access.finance) {
    delete metrics.commissionPaidMinor;
    delete metrics.pendingCommissions;
    delete metrics.pendingCommissionMinor;
    delete metrics.walletLiabilityMinor;
    delete metrics.pendingWithdrawalsMinor;
    delete metrics.completedWithdrawalsMinor;
  }
  if (!access.sales) { delete metrics.totalSalesMinor; delete metrics.orders; }
  return {
    ...data, access, metrics,
    charts: { ...data.charts, salesTrend: access.sales ? data.charts.salesTrend : [], commissionTrend: access.finance ? data.charts.commissionTrend : [], withdrawalTrend: access.finance ? data.charts.withdrawalTrend : [] },
    recentMembers: access.members ? data.recentMembers : [],
    pendingWithdrawals: access.withdrawals ? data.pendingWithdrawals : [],
    recentOrders: access.orders ? data.recentOrders : [],
    recentCommissions: access.commissions ? data.recentCommissions : [],
    securityActivity: access.audit ? data.securityActivity : [],
  };
}
