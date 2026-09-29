import "server-only";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { AuditLog, CommissionTransaction, MemberProfile, Order, Payment, User, Wallet, Withdrawal } from "@/models";

export type AdminDashboardRange = { key: "today" | "7d" | "30d" | "month" | "custom"; start: Date; end: Date; label: string };
type Bucket = { key: string; label: string; start: Date };
const pendingWithdrawalStatuses = ["PENDING", "APPROVED", "PROCESSING"] as const;
const dateValue = (value: unknown, name: string) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw errors.badRequest(`${name} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw errors.badRequest(`${name} is not a valid date.`);
  return parsed;
};
const addDays = (date: Date, days: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
const formatDate = (date: Date) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
const formatMonth = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
const stringValue = (value: unknown) => typeof value === "bigint" ? value.toString() : value == null ? "0" : String(value);

export function parseAdminDashboardRange(params: URLSearchParams): AdminDashboardRange {
  const key = params.get("range") ?? "30d";
  const now = new Date(); const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (key === "today") return { key, start: today, end: now, label: "Today" };
  if (key === "7d") return { key, start: addDays(today, -6), end: now, label: "Last 7 days" };
  if (key === "30d") return { key, start: addDays(today, -29), end: now, label: "Last 30 days" };
  if (key === "month") return { key, start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: now, label: "This month" };
  if (key !== "custom") throw errors.badRequest("Invalid dashboard range.");
  const start = dateValue(params.get("from"), "from"); const inclusiveEnd = dateValue(params.get("to"), "to"); const end = addDays(inclusiveEnd, 1);
  if (end <= start) throw errors.badRequest("The end date must follow the start date.");
  if ((end.getTime() - start.getTime()) / 86_400_000 > 366) throw errors.badRequest("Custom date ranges cannot exceed 366 days.");
  return { key, start, end, label: `${formatDate(start)} – ${formatDate(inclusiveEnd)}` };
}

function buildBuckets(range: AdminDashboardRange): Bucket[] {
  const durationDays = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86_400_000));
  if (durationDays <= 45) {
    const start = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), range.start.getUTCDate()));
    return Array.from({ length: durationDays }, (_, index) => { const date = addDays(start, index); return { key: date.toISOString().slice(0, 10), label: formatDate(date), start: date }; });
  }
  const start = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1)); const endMonth = new Date(Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1)); const values: Bucket[] = [];
  for (let date = start; date <= endMonth; date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))) values.push({ key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`, label: formatMonth(date), start: date });
  return values;
}

function aggregationDateExpression(field: string, monthly: boolean) { return { $dateToString: { format: monthly ? "%Y-%m" : "%Y-%m-%d", date: `$${field}`, timezone: "UTC" } }; }

export type AdminDashboardData = {
  range: { key: AdminDashboardRange["key"]; label: string; from: string; to: string };
  currency: string;
  metrics: {
    totalMembers: number; activeMembers: number; newMembers: number; previousNewMembers: number;
    totalSalesMinor: string; salesInRangeMinor: string; totalCommissionMinor: string; commissionInRangeMinor: string;
    walletLiabilityMinor: string; pendingWithdrawalCount: number; pendingWithdrawalsMinor: string;
    completedWithdrawalCount: number; completedWithdrawalsMinor: string; completedWithdrawalsInRangeMinor: string;
    totalOrders: number; ordersInRange: number; successfulPayments: number; successfulPaymentsInRange: number;
  };
  charts: { memberGrowth: Array<{ label: string; count: number }>; salesTrend: Array<{ label: string; amountMinor: string }>; commissionTrend: Array<{ label: string; amountMinor: string }>; withdrawalTrend: Array<{ label: string; amountMinor: string }> };
  recentMembers: Array<{ id: string; memberNumber: string; name: string; status: string; joinedAt: string }>;
  pendingWithdrawals: Array<{ id: string; memberName: string; memberNumber: string; amountMinor: string; currency: string; status: string; createdAt: string }>;
  recentOrders: Array<{ id: string; orderNumber: string; memberName: string; memberNumber: string; totalMinor: string; currency: string; status: string; paymentStatus: string; createdAt: string }>;
  recentPayments: Array<{ id: string; orderNumber: string; memberName: string; memberNumber: string; amountMinor: string; currency: string; provider: string; status: string; createdAt: string }>;
  recentCommissions: Array<{ id: string; memberName: string; memberNumber: string; type: string; amountMinor: string; currency: string; status: string; createdAt: string }>;
  securityActivity: Array<{ id: string; action: string; resourceType: string; actorName: string; createdAt: string }>;
};

export class DashboardService {
  static async getAdminDashboard(range: AdminDashboardRange): Promise<AdminDashboardData> {
    await connectToDatabase();
  const buckets = buildBuckets(range); const monthly = buckets.length > 0 && range.end.getTime() - range.start.getTime() > 45 * 86_400_000;
  const time = { $gte: range.start, $lt: range.end };
  const previousDuration = range.end.getTime() - range.start.getTime();
  const previousTime = { $gte: new Date(range.start.getTime() - previousDuration), $lt: range.start };
  const [totalMembers, activeMembers, newMembers, previousNewMembers, totalOrders, ordersInRange, totalSales, salesInRange, totalCommission, commissionInRange, liability, pendingWithdrawals, completedWithdrawals, completedWithdrawalsInRange, successfulPayments, successfulPaymentsInRange, memberTrend, salesTrend, commissionTrend, withdrawalTrend, recentMembers, withdrawalRows, orderRows, paymentRows, commissionRows, auditRows] = await Promise.all([
    MemberProfile.countDocuments(),
    MemberProfile.countDocuments({ activationStatus: "ACTIVE" }),
    MemberProfile.countDocuments({ createdAt: time }),
    MemberProfile.countDocuments({ createdAt: previousTime }),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: time }),
    Order.aggregate<{ total?: unknown }>([{ $match: { paymentStatus: "SUCCESS" } }, { $group: { _id: null, total: { $sum: "$totalMinor" } } }]),
    Order.aggregate<{ total?: unknown }>([{ $match: { paymentStatus: "SUCCESS", paidAt: time } }, { $group: { _id: null, total: { $sum: "$totalMinor" } } }]),
    CommissionTransaction.aggregate<{ total?: unknown }>([{ $match: { status: "APPROVED" } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
    CommissionTransaction.aggregate<{ total?: unknown }>([{ $match: { status: "APPROVED", createdAt: time } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
    Wallet.aggregate<{ total?: unknown }>([{ $group: { _id: null, total: { $sum: { $add: ["$availableMinor", "$heldMinor"] } } } }]),
    Withdrawal.aggregate<{ count: number; total?: unknown }>([{ $match: { status: { $in: pendingWithdrawalStatuses } } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amountMinor" } } }]),
    Withdrawal.aggregate<{ count: number; total?: unknown }>([{ $match: { status: "COMPLETED" } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amountMinor" } } }]),
    Withdrawal.aggregate<{ total?: unknown }>([{ $match: { status: "COMPLETED", completedAt: time } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
    Payment.countDocuments({ status: "SUCCESS" }),
    Payment.countDocuments({ status: "SUCCESS", updatedAt: time }),
    MemberProfile.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: time } }, { $group: { _id: aggregationDateExpression("createdAt", monthly), count: { $sum: 1 } } }]),
    Order.aggregate<{ _id: string; total?: unknown }>([{ $match: { paymentStatus: "SUCCESS", paidAt: time } }, { $group: { _id: aggregationDateExpression("paidAt", monthly), total: { $sum: "$totalMinor" } } }]),
    CommissionTransaction.aggregate<{ _id: string; total?: unknown }>([{ $match: { status: "APPROVED", createdAt: time } }, { $group: { _id: aggregationDateExpression("createdAt", monthly), total: { $sum: "$amountMinor" } } }]),
    Withdrawal.aggregate<{ _id: string; total?: unknown }>([{ $match: { status: "COMPLETED", completedAt: time } }, { $group: { _id: aggregationDateExpression("completedAt", monthly), total: { $sum: "$amountMinor" } } }]),
    MemberProfile.find().sort({ createdAt: -1, _id: -1 }).limit(6).select("memberNumber firstName lastName activationStatus joinedAt").lean(),
    Withdrawal.find({ status: { $in: pendingWithdrawalStatuses } }).sort({ createdAt: 1, _id: 1 }).limit(6).select("memberProfileId amountMinor currency status createdAt").lean(),
    Order.find().sort({ createdAt: -1, _id: -1 }).limit(6).select("orderNumber memberProfileId totalMinor currency status paymentStatus createdAt").lean(),
    Payment.find().sort({ createdAt: -1, _id: -1 }).limit(6).select("orderId amountMinor currency provider status createdAt").lean(),
    CommissionTransaction.find().sort({ createdAt: -1, _id: -1 }).limit(6).select("recipientMemberProfileId commissionType level amountMinor currency status createdAt").lean(),
    AuditLog.find().sort({ createdAt: -1, _id: -1 }).limit(6).select("actorUserId action resourceType createdAt").lean(),
  ]);
  const paymentOrderIds = paymentRows.map((row) => row.orderId);
  const [paymentOrders, actors] = await Promise.all([paymentOrderIds.length ? Order.find({ _id: { $in: paymentOrderIds } }).select("orderNumber memberProfileId").lean() : [], auditRows.length ? User.find({ _id: { $in: auditRows.flatMap((row) => row.actorUserId ? [row.actorUserId] : []) } }).select("displayName email").lean() : []]);
  const profileIds = [...withdrawalRows.map((row) => row.memberProfileId), ...orderRows.map((row) => row.memberProfileId), ...commissionRows.map((row) => row.recipientMemberProfileId), ...paymentOrders.map((order) => order.memberProfileId)];
  const profiles = profileIds.length ? await MemberProfile.find({ _id: { $in: profileIds } }).select("memberNumber firstName lastName").lean() : [];
  const profileById = new Map(profiles.map((profile) => [String(profile._id), profile])); const actorById = new Map(actors.map((actor) => [String(actor._id), actor]));
  const paymentOrderById = new Map(paymentOrders.map((order) => [String(order._id), order]));
  const indexed = <T extends { _id: string }>(values: T[]) => new Map(values.map((value) => [value._id, value]));
  const memberByPeriod = indexed(memberTrend); const salesByPeriod = indexed(salesTrend); const commissionByPeriod = indexed(commissionTrend); const withdrawalByPeriod = indexed(withdrawalTrend);
  const profileName = (id: unknown) => { const profile = profileById.get(String(id)); return profile ? { memberName: `${profile.firstName} ${profile.lastName}`, memberNumber: profile.memberNumber } : { memberName: "Unknown member", memberNumber: "—" }; };
  return {
    range: { key: range.key, label: range.label, from: range.start.toISOString(), to: range.end.toISOString() }, currency: "INR",
    metrics: { totalMembers, activeMembers, newMembers, previousNewMembers, totalSalesMinor: stringValue(totalSales[0]?.total), salesInRangeMinor: stringValue(salesInRange[0]?.total), totalCommissionMinor: stringValue(totalCommission[0]?.total), commissionInRangeMinor: stringValue(commissionInRange[0]?.total), walletLiabilityMinor: stringValue(liability[0]?.total), pendingWithdrawalCount: pendingWithdrawals[0]?.count ?? 0, pendingWithdrawalsMinor: stringValue(pendingWithdrawals[0]?.total), completedWithdrawalCount: completedWithdrawals[0]?.count ?? 0, completedWithdrawalsMinor: stringValue(completedWithdrawals[0]?.total), completedWithdrawalsInRangeMinor: stringValue(completedWithdrawalsInRange[0]?.total), totalOrders, ordersInRange, successfulPayments, successfulPaymentsInRange },
    charts: { memberGrowth: buckets.map((bucket) => ({ label: bucket.label, count: memberByPeriod.get(bucket.key)?.count ?? 0 })), salesTrend: buckets.map((bucket) => ({ label: bucket.label, amountMinor: stringValue(salesByPeriod.get(bucket.key)?.total) })), commissionTrend: buckets.map((bucket) => ({ label: bucket.label, amountMinor: stringValue(commissionByPeriod.get(bucket.key)?.total) })), withdrawalTrend: buckets.map((bucket) => ({ label: bucket.label, amountMinor: stringValue(withdrawalByPeriod.get(bucket.key)?.total) })) },
    recentMembers: recentMembers.map((member) => ({ id: String(member._id), memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, status: member.activationStatus, joinedAt: member.joinedAt.toISOString() })),
    pendingWithdrawals: withdrawalRows.map((row) => ({ id: String(row._id), ...profileName(row.memberProfileId), amountMinor: row.amountMinor.toString(), currency: row.currency, status: row.status, createdAt: row.createdAt.toISOString() })),
    recentOrders: orderRows.map((row) => ({ id: String(row._id), orderNumber: row.orderNumber, ...profileName(row.memberProfileId), totalMinor: row.totalMinor.toString(), currency: row.currency, status: row.status, paymentStatus: row.paymentStatus, createdAt: row.createdAt.toISOString() })),
    recentPayments: paymentRows.map((row) => { const order = paymentOrderById.get(String(row.orderId)); return { id: String(row._id), orderNumber: order?.orderNumber ?? "Unknown order", ...profileName(order?.memberProfileId), amountMinor: row.amountMinor.toString(), currency: row.currency, provider: row.provider, status: row.status, createdAt: row.createdAt.toISOString() }; }),
    recentCommissions: commissionRows.map((row) => ({ id: String(row._id), ...profileName(row.recipientMemberProfileId), type: row.commissionType === "LEVEL" ? `Level ${row.level} commission` : "Direct commission", amountMinor: row.amountMinor.toString(), currency: row.currency, status: row.status, createdAt: row.createdAt.toISOString() })),
    securityActivity: auditRows.map((row) => ({ id: String(row._id), action: row.action, resourceType: row.resourceType, actorName: row.actorUserId ? actorById.get(String(row.actorUserId))?.displayName ?? "System" : "System", createdAt: row.createdAt.toISOString() })),
  };
  }
}

/** Backward-compatible service entry point for current route handlers. */
export const getAdminDashboard = (range: AdminDashboardRange) => DashboardService.getAdminDashboard(range);
