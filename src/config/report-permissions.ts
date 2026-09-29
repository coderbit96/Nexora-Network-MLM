import { PERMISSION, type PermissionKey } from "./permissions";

export const REPORT_NAMES = ["members", "referrals", "commissions", "wallet-transactions", "withdrawals", "sales", "orders"] as const;
export type ReportName = (typeof REPORT_NAMES)[number];
export const REPORT_PERMISSION: Record<ReportName, PermissionKey> = {
  members: PERMISSION.REPORTS.MEMBERS,
  referrals: PERMISSION.REPORTS.MEMBERS,
  commissions: PERMISSION.REPORTS.COMMISSIONS,
  "wallet-transactions": PERMISSION.REPORTS.WALLET,
  withdrawals: PERMISSION.REPORTS.WITHDRAWALS,
  sales: PERMISSION.REPORTS.SALES,
  orders: PERMISSION.REPORTS.SALES,
};
