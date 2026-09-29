import "server-only";

import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { decimalToMinorUnits } from "@/lib/money/minor-units";
import { MemberProfile, User, Wallet, WalletTransaction } from "@/models";
import type { LedgerDirection, WalletTransactionType } from "@/types/domain";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";

const transactionTypes: readonly WalletTransactionType[] = ["DIRECT_COMMISSION", "LEVEL_COMMISSION", "WITHDRAWAL_RESERVATION", "WITHDRAWAL", "WITHDRAWAL_RELEASE", "WITHDRAWAL_REVERSAL", "ADMIN_CREDIT", "ADMIN_DEBIT", "ORDER_REFUND_ADJUSTMENT", "OTHER"];

export type WalletTransactionFilters = { type?: WalletTransactionType; direction?: LedgerDirection; page: number; limit: number };
export type WalletListFilters = { page: number; limit: number; q?: string; minBalanceMinor?: bigint; maxBalanceMinor?: bigint };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compact = (value: string | null) => value?.trim().slice(0, 100) || undefined;

function parseBalance(value: string | null, label: string) {
  if (!value) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw errors.badRequest(`${label} must be a non-negative amount with up to two decimal places.`);
  return decimalToMinorUnits(value);
}

/** Bounded filters for wallet account summaries; values are converted without floats. */
export function parseWalletListFilters(params: URLSearchParams): WalletListFilters {
  const numeric = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const page = numeric(params.get("page"), 1); const limit = numeric(params.get("limit"), 20);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid wallet pagination.");
  const minBalanceMinor = parseBalance(params.get("minBalance"), "Minimum balance");
  const maxBalanceMinor = parseBalance(params.get("maxBalance"), "Maximum balance");
  if (minBalanceMinor !== undefined && maxBalanceMinor !== undefined && minBalanceMinor > maxBalanceMinor) throw errors.badRequest("The balance range is invalid.");
  return { page, limit, ...(compact(params.get("q")) ? { q: compact(params.get("q")) } : {}), ...(minBalanceMinor !== undefined ? { minBalanceMinor } : {}), ...(maxBalanceMinor !== undefined ? { maxBalanceMinor } : {}) };
}

export function parseWalletFilters(params: URLSearchParams): WalletTransactionFilters {
  const type = params.get("type") || undefined;
  const direction = params.get("direction") || undefined;
  if (type && !transactionTypes.includes(type as WalletTransactionType)) throw errors.badRequest("Invalid wallet transaction type.");
  if (direction && direction !== "CREDIT" && direction !== "DEBIT") throw errors.badRequest("Invalid wallet transaction direction.");
  const numeric = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const page = numeric(params.get("page"), 1);
  const limit = numeric(params.get("limit"), 20);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid wallet pagination.");
  return { ...(type ? { type: type as WalletTransactionType } : {}), ...(direction ? { direction: direction as LedgerDirection } : {}), page, limit };
}

export async function getWalletOverview(memberProfileId: Types.ObjectId, currency = "INR") {
  const wallet = await Wallet.findOne({ memberProfileId, currency: currency.toUpperCase() }).lean();
  if (!wallet) throw errors.notFound("The member wallet was not found.");
  return wallet;
}

export async function getWalletTransactionPage(memberProfileId: Types.ObjectId, filters: WalletTransactionFilters) {
  const query = { memberProfileId, ...(filters.type ? { type: filters.type } : {}), ...(filters.direction ? { direction: filters.direction } : {}) };
  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    WalletTransaction.countDocuments(query),
  ]);
  return { transactions, total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) };
}

export async function getWalletAccountPage(filters: WalletListFilters) {
  const clauses: Record<string, unknown>[] = [];
  if (filters.q) {
    const regex = new RegExp(escapeRegex(filters.q), "i");
    const matchingUsers = await User.find({ email: regex }).select("_id").limit(1_000).lean();
    const profiles = await MemberProfile.find({ $or: [{ memberNumber: regex }, { referralCode: regex }, { firstName: regex }, { lastName: regex }, { userId: { $in: matchingUsers.map((user) => user._id) } }] }).select("_id").limit(1_000).lean();
    if (!profiles.length) return { items: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 1 };
    clauses.push({ memberProfileId: { $in: profiles.map((profile) => profile._id) } });
  }
  if (filters.minBalanceMinor !== undefined || filters.maxBalanceMinor !== undefined) clauses.push({ availableMinor: { ...(filters.minBalanceMinor !== undefined ? { $gte: filters.minBalanceMinor } : {}), ...(filters.maxBalanceMinor !== undefined ? { $lte: filters.maxBalanceMinor } : {}) } });
  const query = clauses.length ? { $and: clauses } : {};
  const [wallets, total] = await Promise.all([
    Wallet.find(query).sort({ updatedAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Wallet.countDocuments(query),
  ]);
  const profileIds = wallets.map((wallet) => wallet.memberProfileId);
  const walletIds = wallets.map((wallet) => wallet._id);
  const [profiles, lastTransactions] = await Promise.all([
    profileIds.length ? MemberProfile.find({ _id: { $in: profileIds } }).select("userId memberNumber firstName lastName activationStatus").lean() : [],
    walletIds.length ? WalletTransaction.aggregate<{ _id: Types.ObjectId; transaction: { type: string; createdAt: Date } }>([{ $match: { walletId: { $in: walletIds } } }, { $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: "$walletId", transaction: { $first: { type: "$type", createdAt: "$createdAt" } } } }]) : [],
  ]);
  const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]));
  const lastTransactionByWallet = new Map(lastTransactions.map((row) => [String(row._id), row.transaction]));
  return {
    items: wallets.flatMap((wallet) => {
      const profile = profileById.get(String(wallet.memberProfileId));
      if (!profile) return [];
      const lastTransaction = lastTransactionByWallet.get(String(wallet._id));
      return [{ id: String(wallet._id), memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`.trim(), status: profile.activationStatus, currency: wallet.currency, availableMinor: wallet.availableMinor.toString(), heldMinor: wallet.heldMinor.toString(), lifetimeEarningsMinor: wallet.lifetimeEarningsMinor.toString(), lifetimeWithdrawalsMinor: wallet.lifetimeWithdrawalsMinor.toString(), lastTransaction: lastTransaction ? { type: lastTransaction.type, createdAt: lastTransaction.createdAt.toISOString() } : null }];
    }),
    total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
}

export function serializeWallet(wallet: Awaited<ReturnType<typeof getWalletOverview>>) {
  return {
    id: String(wallet._id), currency: wallet.currency,
    availableMinor: wallet.availableMinor.toString(), heldMinor: wallet.heldMinor.toString(),
    lifetimeCreditMinor: wallet.lifetimeCreditMinor.toString(), lifetimeDebitMinor: wallet.lifetimeDebitMinor.toString(),
    lifetimeEarningsMinor: wallet.lifetimeEarningsMinor.toString(), lifetimeWithdrawalsMinor: wallet.lifetimeWithdrawalsMinor.toString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export function serializeWalletTransaction(transaction: Awaited<ReturnType<typeof getWalletTransactionPage>>["transactions"][number]) {
  return {
    id: String(transaction._id), currency: transaction.currency, type: transaction.type, direction: transaction.direction,
    amountMinor: transaction.amountMinor.toString(), resultingAvailableMinor: transaction.resultingAvailableMinor.toString(),
    resultingHeldMinor: transaction.resultingHeldMinor.toString(), referenceType: transaction.referenceType, referenceId: transaction.referenceId,
    description: transaction.description, createdAt: transaction.createdAt.toISOString(),
  };
}
