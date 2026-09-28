import "server-only";

import type { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { CommissionTransaction, MemberProfile, Notification, Order, SponsorRelationship, Wallet, WalletTransaction, Withdrawal } from "@/models";

const dashboardCurrency = "INR";
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const minorString = (value: unknown) => typeof value === "bigint" ? value.toString() : value == null ? "0" : String(value);

function months(count = 6) {
  const today = new Date();
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (count - 1 - index), 1));
    return { key: monthKey(date), label: new Intl.DateTimeFormat("en", { month: "short" }).format(date), start: date };
  });
}

export type MemberDashboardData = {
  member: { firstName: string; memberNumber: string; referralCode: string };
  currency: string;
  metrics: { availableBalanceMinor: string; lifetimeEarningsMinor: string; directReferrals: number; totalTeam: number; pendingWithdrawalMinor: string; orders: number };
  charts: { earnings: Array<{ label: string; amountMinor: string }>; commissionBreakdown: Array<{ name: "Direct" | "Level"; amountMinor: string }>; teamGrowth: Array<{ label: string; members: number }> };
  recentEarnings: Array<{ id: string; type: "DIRECT" | "LEVEL"; level?: number; amountMinor: string; currency: string; sourceMemberName: string; createdAt: string }>;
  recentWalletTransactions: Array<{ id: string; type: string; direction: "CREDIT" | "DEBIT"; amountMinor: string; description: string; createdAt: string }>;
  recentReferrals: Array<{ memberNumber: string; name: string; status: string; joinedAt: string }>;
  recentOrders: Array<{ id: string; orderNumber: string; totalMinor: string; status: string; paymentStatus: string; createdAt: string }>;
  notifications: Array<{ id: string; type: string; title: string; body: string; actionUrl?: string; createdAt: string; read: boolean }>;
  referral: { url: string; directReferrals: number; teamMembers: number };
};

export async function getMemberDashboard(memberProfileId: Types.ObjectId, baseUrl: string): Promise<MemberDashboardData> {
  await connectToDatabase();
  const profile = await MemberProfile.findById(memberProfileId).select("userId firstName memberNumber referralCode").lean();
  if (!profile) throw new Error("Member profile was not found.");
  const bucketMonths = months(); const firstMonth = bucketMonths[0].start;
  const [wallet, directReferrals, totalTeam, orders, pendingWithdrawals, commissionBuckets, teamBuckets, commissionBreakdown, recentCommissions, recentWalletTransactions, recentRelations, recentOrders, notifications] = await Promise.all([
    Wallet.findOne({ memberProfileId }).sort({ updatedAt: -1 }).lean(),
    SponsorRelationship.countDocuments({ sponsorMemberProfileId: memberProfileId }),
    SponsorRelationship.countDocuments({ uplineMemberProfileIds: memberProfileId }),
    Order.countDocuments({ memberProfileId }),
    Withdrawal.aggregate<{ total?: unknown }>([{ $match: { memberProfileId, status: { $in: ["PENDING", "APPROVED", "PROCESSING"] } } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
    CommissionTransaction.aggregate<{ _id: string; total: unknown }>([{ $match: { recipientMemberProfileId: memberProfileId, status: "APPROVED", createdAt: { $gte: firstMonth } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } }, total: { $sum: "$amountMinor" } } }]),
    SponsorRelationship.aggregate<{ _id: string; total: number }>([{ $match: { uplineMemberProfileIds: memberProfileId, createdAt: { $gte: firstMonth } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } }, total: { $sum: 1 } } }]),
    CommissionTransaction.aggregate<{ _id: "DIRECT" | "LEVEL"; total: unknown }>([{ $match: { recipientMemberProfileId: memberProfileId, status: "APPROVED" } }, { $group: { _id: "$commissionType", total: { $sum: "$amountMinor" } } }]),
    CommissionTransaction.find({ recipientMemberProfileId: memberProfileId, status: "APPROVED" }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
    WalletTransaction.find({ memberProfileId }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
    SponsorRelationship.find({ sponsorMemberProfileId: memberProfileId }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
    Order.find({ memberProfileId }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
    Notification.find({ userId: profile?.userId }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
  ]);
  const sourceProfiles = recentCommissions.length ? await MemberProfile.find({ _id: { $in: recentCommissions.map((entry) => entry.sourceMemberProfileId) } }).select("firstName lastName").lean() : [];
  const referralProfiles = recentRelations.length ? await MemberProfile.find({ _id: { $in: recentRelations.map((entry) => entry.memberProfileId) } }).select("firstName lastName memberNumber activationStatus joinedAt").lean() : [];
  const sourceById = new Map(sourceProfiles.map((entry) => [String(entry._id), `${entry.firstName} ${entry.lastName}`]));
  const referralById = new Map(referralProfiles.map((entry) => [String(entry._id), entry]));
  const commissionByMonth = new Map(commissionBuckets.map((entry) => [entry._id, minorString(entry.total)]));
  const teamByMonth = new Map(teamBuckets.map((entry) => [entry._id, entry.total]));
  const breakdownByType = new Map(commissionBreakdown.map((entry) => [entry._id, minorString(entry.total)]));
  const currency = wallet?.currency ?? dashboardCurrency;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    member: { firstName: profile.firstName, memberNumber: profile.memberNumber, referralCode: profile.referralCode },
    currency,
    metrics: { availableBalanceMinor: minorString(wallet?.availableMinor), lifetimeEarningsMinor: minorString(wallet?.lifetimeEarningsMinor), directReferrals, totalTeam, pendingWithdrawalMinor: minorString(pendingWithdrawals[0]?.total), orders },
    charts: {
      earnings: bucketMonths.map(({ key, label }) => ({ label, amountMinor: commissionByMonth.get(key) ?? "0" })),
      commissionBreakdown: [{ name: "Direct", amountMinor: breakdownByType.get("DIRECT") ?? "0" }, { name: "Level", amountMinor: breakdownByType.get("LEVEL") ?? "0" }],
      teamGrowth: bucketMonths.map(({ key, label }) => ({ label, members: teamByMonth.get(key) ?? 0 })),
    },
    recentEarnings: recentCommissions.map((entry) => ({ id: String(entry._id), type: entry.commissionType, ...(entry.level ? { level: entry.level } : {}), amountMinor: entry.amountMinor.toString(), currency: entry.currency, sourceMemberName: sourceById.get(String(entry.sourceMemberProfileId)) ?? "Network member", createdAt: entry.createdAt.toISOString() })),
    recentWalletTransactions: recentWalletTransactions.map((entry) => ({ id: String(entry._id), type: entry.type, direction: entry.direction, amountMinor: entry.amountMinor.toString(), description: entry.description, createdAt: entry.createdAt.toISOString() })),
    recentReferrals: recentRelations.flatMap((relation) => { const member = referralById.get(String(relation.memberProfileId)); return member ? [{ memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, status: member.activationStatus, joinedAt: member.joinedAt.toISOString() }] : []; }),
    recentOrders: recentOrders.map((entry) => ({ id: String(entry._id), orderNumber: entry.orderNumber, totalMinor: entry.totalMinor.toString(), status: entry.status, paymentStatus: entry.paymentStatus, createdAt: entry.createdAt.toISOString() })),
    notifications: notifications.map((entry) => ({ id: String(entry._id), type: entry.type, title: entry.title, body: entry.body, ...(entry.actionUrl ? { actionUrl: entry.actionUrl } : {}), createdAt: entry.createdAt.toISOString(), read: Boolean(entry.readAt) })),
    referral: { url: `${normalizedBaseUrl}/register?ref=${encodeURIComponent(profile.referralCode)}`, directReferrals, teamMembers: totalTeam },
  };
}
