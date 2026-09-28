import { PERMISSION, type PermissionKey } from "@/config/permissions";

/**
 * Server-safe navigation authorization metadata. Keep this separate from the
 * client navigation configuration because React icon components cannot cross
 * an RSC boundary.
 */
export const adminNavigationAccess: ReadonlyArray<{ label: string; permission?: PermissionKey; superAdminOnly?: boolean }> = [
  { label: "Dashboard" },
  { label: "Members", permission: PERMISSION.MEMBERS.VIEW },
  { label: "Genealogy", permission: PERMISSION.GENEALOGY.VIEW_ALL },
  { label: "Commissions", permission: PERMISSION.COMMISSIONS.VIEW_ALL },
  { label: "Wallet", permission: PERMISSION.WALLET.VIEW_ALL },
  { label: "Withdrawals", permission: PERMISSION.WITHDRAWALS.VIEW_ALL },
  { label: "Products", permission: PERMISSION.PRODUCTS.VIEW },
  { label: "Categories", permission: PERMISSION.CATEGORIES.VIEW },
  { label: "Orders", permission: PERMISSION.ORDERS.VIEW_ALL },
  { label: "Payments", permission: PERMISSION.PAYMENTS.VIEW },
  { label: "Reports", permission: PERMISSION.REPORTS.VIEW },
  { label: "Wallet ledger", permission: PERMISSION.WALLET.VIEW_ALL },
  { label: "Staff", permission: PERMISSION.STAFF.VIEW },
  { label: "Roles", permission: PERMISSION.ROLES.VIEW },
  { label: "Permissions", permission: PERMISSION.ROLES.VIEW },
  { label: "Settings", permission: PERMISSION.SETTINGS.MANAGE, superAdminOnly: true },
  { label: "Notifications", permission: PERMISSION.NOTIFICATIONS.VIEW },
  { label: "Audit logs", permission: PERMISSION.AUDIT.VIEW },
];
