import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_PAGE_PERMISSION } from "@/config/admin-page-permissions";
import { PERMISSION } from "@/config/permissions";

test("admin pages have explicit catalog-backed server permission mappings", () => {
  assert.deepEqual(ADMIN_PAGE_PERMISSION, {
    dashboard: PERMISSION.DASHBOARD.VIEW,
    members: PERMISSION.MEMBERS.VIEW,
    genealogy: PERMISSION.GENEALOGY.VIEW_ALL,
    commissions: PERMISSION.COMMISSIONS.VIEW_ALL,
    wallet: PERMISSION.WALLET.VIEW_ALL,
    walletTransactions: PERMISSION.WALLET.VIEW_ALL,
    withdrawals: PERMISSION.WITHDRAWALS.VIEW_ALL,
    products: PERMISSION.PRODUCTS.VIEW,
    categories: PERMISSION.CATEGORIES.VIEW,
    orders: PERMISSION.ORDERS.VIEW_ALL,
    payments: PERMISSION.PAYMENTS.VIEW,
    reports: PERMISSION.REPORTS.VIEW,
    staff: PERMISSION.STAFF.VIEW,
    roles: PERMISSION.ROLES.VIEW,
    permissions: PERMISSION.ROLES.VIEW,
    settings: PERMISSION.SETTINGS.VIEW,
    notifications: PERMISSION.NOTIFICATIONS.VIEW,
    auditLogs: PERMISSION.AUDIT.VIEW,
  });
});
