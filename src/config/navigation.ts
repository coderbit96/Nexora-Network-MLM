import type { LucideIcon } from "lucide-react";
import { PERMISSION, type PermissionKey } from "@/config/permissions";
import {
  BadgeIndianRupee,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  CircleDollarSign,
  GitBranch,
  LayoutDashboard,
  Network,
  Package,
  ReceiptText,
  ShoppingCart,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
  description?: string;
  permission?: PermissionKey;
  superAdminOnly?: boolean;
};

export const memberNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/member", icon: LayoutDashboard },
  { label: "My Network", href: "/member/team", icon: Network },
  { label: "Direct Referrals", href: "/member/direct-referrals", icon: Users },
  { label: "Referral link", href: "/member/referral", icon: Users },
  { label: "Genealogy", href: "/member/genealogy", icon: GitBranch },
  { label: "Earnings", icon: CircleDollarSign, disabled: true, description: "Available after commission processing is introduced." },
  { label: "Wallet", href: "/member/wallet", icon: WalletCards },
  { label: "Withdrawals", href: "/member/withdrawals", icon: BadgeIndianRupee },
  { label: "Products", href: "/member/products", icon: Package },
  { label: "Cart", href: "/member/cart", icon: ShoppingCart },
  { label: "Orders", href: "/member/orders", icon: ReceiptText },
  { label: "Profile", href: "/member/profile", icon: Settings },
  { label: "Notifications", href: "/member/notifications", icon: Bell },
];

export const adminNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/admin/members", icon: Users, permission: PERMISSION.MEMBERS.VIEW },
  { label: "Genealogy", href: "/admin/genealogy", icon: GitBranch, permission: PERMISSION.GENEALOGY.VIEW_ALL },
  { label: "Commissions", href: "/admin/commissions", icon: CircleDollarSign, permission: PERMISSION.COMMISSIONS.VIEW_ALL },
  { label: "Wallet", href: "/admin/wallet", icon: WalletCards, permission: PERMISSION.WALLET.VIEW_ALL },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: BadgeIndianRupee, permission: PERMISSION.WITHDRAWALS.VIEW_ALL },
  { label: "Products", href: "/admin/products", icon: Package, permission: PERMISSION.PRODUCTS.VIEW },
  { label: "Categories", href: "/admin/categories", icon: Boxes, permission: PERMISSION.CATEGORIES.VIEW },
  { label: "Orders", href: "/admin/orders", icon: ReceiptText, permission: PERMISSION.ORDERS.VIEW_ALL },
  { label: "Payments", href: "/admin/payments", icon: ReceiptText, permission: PERMISSION.PAYMENTS.VIEW },
  { label: "Reports", href: "/admin/reports", icon: ChartNoAxesCombined, permission: PERMISSION.REPORTS.VIEW },
  { label: "Wallet ledger", href: "/admin/wallet-transactions", icon: WalletCards, permission: PERMISSION.WALLET.VIEW_ALL },
  { label: "Staff", href: "/admin/staff", icon: ShieldCheck, permission: PERMISSION.STAFF.VIEW },
  { label: "Roles", href: "/admin/roles", icon: ShieldCheck, permission: PERMISSION.ROLES.VIEW },
  { label: "Permissions", href: "/admin/permissions", icon: ShieldCheck, permission: PERMISSION.ROLES.VIEW },
  { label: "Settings", href: "/admin/settings", icon: Settings, permission: PERMISSION.SETTINGS.MANAGE, superAdminOnly: true },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, permission: PERMISSION.NOTIFICATIONS.VIEW },
  { label: "Audit logs", href: "/admin/audit-logs", icon: ChartNoAxesCombined, permission: PERMISSION.AUDIT.VIEW },
];

/** Staff starts in its own workspace, then sees only operations granted by its role. */
export const staffNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/staff", icon: LayoutDashboard },
  ...adminNavigation.filter((item) => item.label !== "Dashboard"),
];
