import "server-only";

import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { Withdrawal } from "@/models";
import type { WithdrawalStatus } from "@/types/domain";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";

const statuses: readonly WithdrawalStatus[] = ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"];
export type WithdrawalFilters = { status?: WithdrawalStatus; page: number; limit: number };

export function parseWithdrawalFilters(params: URLSearchParams): WithdrawalFilters {
  const status = params.get("status") || undefined;
  if (status && !statuses.includes(status as WithdrawalStatus)) throw errors.badRequest("Invalid withdrawal status.");
  const parse = (value: string | null, fallback: number) => value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const page = parse(params.get("page"), 1); const limit = parse(params.get("limit"), 20);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid withdrawal pagination.");
  return { ...(status ? { status: status as WithdrawalStatus } : {}), page, limit };
}

export async function getWithdrawalPage(filters: WithdrawalFilters, memberProfileId?: Types.ObjectId) {
  const query = { ...(memberProfileId ? { memberProfileId } : {}), ...(filters.status ? { status: filters.status } : {}) };
  const [withdrawals, total] = await Promise.all([
    Withdrawal.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Withdrawal.countDocuments(query),
  ]);
  return { withdrawals, total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) };
}

export function serializeWithdrawal(withdrawal: Awaited<ReturnType<typeof getWithdrawalPage>>["withdrawals"][number]) {
  return {
    id: String(withdrawal._id), amountMinor: withdrawal.amountMinor.toString(), currency: withdrawal.currency, status: withdrawal.status,
    requestedAt: withdrawal.createdAt.toISOString(), updatedAt: withdrawal.updatedAt.toISOString(),
    ...(withdrawal.paymentReference ? { paymentReference: withdrawal.paymentReference } : {}),
    destination: { accountLast4: String(withdrawal.destinationSnapshot.accountLast4 ?? "") },
    timeline: withdrawal.statusHistory.map((entry) => ({ status: entry.status, changedAt: entry.changedAt.toISOString(), ...(entry.note ? { note: entry.note } : {}), ...(entry.paymentReference ? { paymentReference: entry.paymentReference } : {}) })),
  };
}
