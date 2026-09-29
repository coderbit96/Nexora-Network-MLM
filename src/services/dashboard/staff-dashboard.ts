import "server-only";

import { PERMISSION } from "@/config/permissions";
import type { AuthContext } from "@/lib/auth/authorization";
import { hasPermission } from "@/lib/auth/policy";
import { connectToDatabase } from "@/lib/db/mongoose";
import { MemberProfile, Order, Payment, Product, Withdrawal } from "@/models";

export type StaffQueue = {
  key: "members" | "withdrawals-approve" | "withdrawals-process" | "withdrawals-complete" | "orders" | "payments" | "products";
  title: string;
  description: string;
  count: number;
  href: string;
};

type QueuePlan = Omit<StaffQueue, "count"> & { count: () => Promise<number> };

/**
 * A strictly permission-scoped operational inbox. Counts are queried only for
 * functions the current staff member may open, so the dashboard cannot become
 * a side channel for restricted operational data.
 */
export async function getStaffDashboard(context: AuthContext) {
  await connectToDatabase();
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(context, permission);
  const plans: QueuePlan[] = [];

  if (can(PERMISSION.MEMBERS.VIEW)) {
    plans.push({ key: "members", title: "Pending member accounts", description: "Member profiles awaiting activation or follow-up.", href: "/admin/members", count: () => MemberProfile.countDocuments({ activationStatus: "PENDING" }) });
  }
  if (can(PERMISSION.WITHDRAWALS.VIEW_ALL) && can(PERMISSION.WITHDRAWALS.APPROVE)) {
    plans.push({ key: "withdrawals-approve", title: "Withdrawals to approve", description: "Pending requests ready for review.", href: "/admin/withdrawals", count: () => Withdrawal.countDocuments({ status: "PENDING" }) });
  }
  if (can(PERMISSION.WITHDRAWALS.VIEW_ALL) && can(PERMISSION.WITHDRAWALS.PROCESS)) {
    plans.push({ key: "withdrawals-process", title: "Withdrawals to process", description: "Approved requests awaiting payout processing.", href: "/admin/withdrawals", count: () => Withdrawal.countDocuments({ status: "APPROVED" }) });
  }
  if (can(PERMISSION.WITHDRAWALS.VIEW_ALL) && can(PERMISSION.WITHDRAWALS.COMPLETE)) {
    plans.push({ key: "withdrawals-complete", title: "Payouts to complete", description: "Processing withdrawals awaiting a payment reference.", href: "/admin/withdrawals", count: () => Withdrawal.countDocuments({ status: "PROCESSING" }) });
  }
  if (can(PERMISSION.ORDERS.VIEW_ALL)) {
    plans.push({ key: "orders", title: "Orders in fulfilment", description: "Paid orders currently being processed.", href: "/admin/orders", count: () => Order.countDocuments({ status: "PROCESSING" }) });
  }
  if (can(PERMISSION.PAYMENTS.VIEW)) {
    plans.push({ key: "payments", title: "Pending payments", description: "Payment attempts still awaiting an authoritative result.", href: "/admin/payments", count: () => Payment.countDocuments({ status: "PENDING" }) });
  }
  if (can(PERMISSION.PRODUCTS.VIEW)) {
    plans.push({ key: "products", title: "Low-stock products", description: "Active products with stock at five units or fewer.", href: "/admin/products", count: () => Product.countDocuments({ status: "ACTIVE", stockQuantity: { $lte: 5 } }) });
  }

  const counts = await Promise.all(plans.map((plan) => plan.count()));
  return {
    assignedFunctionCount: context.permissions.length,
    queues: plans.map((plan, index) => ({ key: plan.key, title: plan.title, description: plan.description, href: plan.href, count: counts[index] })),
  };
}
