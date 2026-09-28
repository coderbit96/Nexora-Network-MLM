import { PERMISSION, type PermissionKey } from "@/config/permissions";

/** The single source of truth for server-rendered admin page access. */
export const ADMIN_PAGE_PERMISSION = {
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
} as const satisfies Record<string, PermissionKey>;
