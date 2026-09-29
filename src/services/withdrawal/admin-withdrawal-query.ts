import "server-only";

import { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { MemberProfile, User, Wallet, Withdrawal } from "@/models";
import type { WithdrawalStatus } from "@/types/domain";
import { getWithdrawalPage, type WithdrawalFilters } from "@/services/withdrawal/withdrawal-query";

type AdminWithdrawal = Awaited<ReturnType<typeof getWithdrawalPage>>["withdrawals"][number];
type Person = { name: string; email: string };
type Member = { memberNumber: string; name: string };

function destination(withdrawal: AdminWithdrawal) {
  const last4 = typeof withdrawal.destinationSnapshot.accountLast4 === "string" ? withdrawal.destinationSnapshot.accountLast4 : "";
  return { paymentMethod: last4 ? "Bank account" : "Payment details unavailable", accountLast4: last4 ? `•••• ${last4}` : "Not available" };
}

function serialize(withdrawal: AdminWithdrawal, members: Map<string, Member>, users: Map<string, Person>) {
  const reviewer = withdrawal.reviewedByUserId ? users.get(String(withdrawal.reviewedByUserId)) ?? null : null;
  return {
    id: String(withdrawal._id),
    member: members.get(String(withdrawal.memberProfileId)) ?? null,
    amountMinor: withdrawal.amountMinor.toString(), currency: withdrawal.currency, status: withdrawal.status,
    requestedAt: withdrawal.createdAt.toISOString(), updatedAt: withdrawal.updatedAt.toISOString(),
    destination: destination(withdrawal), reviewer,
    ...(withdrawal.paymentReference ? { paymentReference: withdrawal.paymentReference } : {}),
    timeline: withdrawal.statusHistory.map((entry) => ({
      status: entry.status, changedAt: entry.changedAt.toISOString(),
      actor: entry.changedByUserId ? users.get(String(entry.changedByUserId))?.name ?? null : null,
      ...(entry.note ? { note: entry.note } : {}), ...(entry.paymentReference ? { paymentReference: entry.paymentReference } : {}),
    })),
  };
}

async function relatedPeople(withdrawals: AdminWithdrawal[]) {
  const memberProfileIds = [...new Set(withdrawals.map((withdrawal) => String(withdrawal.memberProfileId)))].map((id) => new Types.ObjectId(id));
  const reviewerIds = [...new Set(withdrawals.flatMap((withdrawal) => [withdrawal.reviewedByUserId, ...withdrawal.statusHistory.map((entry) => entry.changedByUserId)].filter(Boolean).map(String)))].map((id) => new Types.ObjectId(id));
  const [profiles, users] = await Promise.all([
    memberProfileIds.length ? MemberProfile.find({ _id: { $in: memberProfileIds } }).select("memberNumber firstName lastName").lean() : [],
    reviewerIds.length ? User.find({ _id: { $in: reviewerIds } }).select("displayName email").lean() : [],
  ]);
  return {
    members: new Map(profiles.map((profile) => [String(profile._id), { memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`.trim() }])),
    users: new Map(users.map((user) => [String(user._id), { name: user.displayName, email: user.email }])),
  };
}

export async function getAdminWithdrawalPage(filters: WithdrawalFilters) {
  const page = await getWithdrawalPage(filters);
  const [people, counts] = await Promise.all([
    relatedPeople(page.withdrawals),
    Withdrawal.aggregate<{ _id: WithdrawalStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return {
    withdrawals: page.withdrawals.map((withdrawal) => serialize(withdrawal, people.members, people.users)),
    pagination: { total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages },
    statusCounts: Object.fromEntries(counts.map((item) => [item._id, item.count])) as Partial<Record<WithdrawalStatus, number>>,
  };
}

export async function getAdminWithdrawalDetail(id: string) {
  if (!Types.ObjectId.isValid(id)) throw errors.notFound("The withdrawal request was not found.");
  const withdrawal = await Withdrawal.findById(id).lean();
  if (!withdrawal) throw errors.notFound("The withdrawal request was not found.");
  const [people, wallet] = await Promise.all([
    relatedPeople([withdrawal]),
    Wallet.findById(withdrawal.walletId).select("currency availableMinor heldMinor lifetimeEarningsMinor lifetimeWithdrawalsMinor").lean(),
  ]);
  return {
    ...serialize(withdrawal, people.members, people.users),
    wallet: wallet ? {
      currency: wallet.currency, availableMinor: wallet.availableMinor.toString(), heldMinor: wallet.heldMinor.toString(),
      lifetimeEarningsMinor: wallet.lifetimeEarningsMinor.toString(), lifetimeWithdrawalsMinor: wallet.lifetimeWithdrawalsMinor.toString(),
    } : null,
  };
}
