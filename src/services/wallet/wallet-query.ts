import "server-only";

import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { Wallet, WalletTransaction } from "@/models";
import type { LedgerDirection, WalletTransactionType } from "@/types/domain";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";

const transactionTypes: readonly WalletTransactionType[] = ["DIRECT_COMMISSION", "LEVEL_COMMISSION", "WITHDRAWAL_RESERVATION", "WITHDRAWAL", "WITHDRAWAL_RELEASE", "WITHDRAWAL_REVERSAL", "ADMIN_CREDIT", "ADMIN_DEBIT", "ORDER_REFUND_ADJUSTMENT", "OTHER"];

export type WalletTransactionFilters = { type?: WalletTransactionType; direction?: LedgerDirection; page: number; limit: number };

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
