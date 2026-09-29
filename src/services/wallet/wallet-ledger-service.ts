import "server-only";

import { Types } from "mongoose";

import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";
import { errors } from "@/lib/errors/app-error";
import { decimalToMinorUnits } from "@/lib/money/minor-units";
import { MemberProfile, User, WalletTransaction } from "@/models";
import type { IWalletTransaction, LedgerDirection, WalletTransactionType } from "@/types/domain";

const TRANSACTION_TYPES: readonly WalletTransactionType[] = ["DIRECT_COMMISSION", "LEVEL_COMMISSION", "WITHDRAWAL_RESERVATION", "WITHDRAWAL", "WITHDRAWAL_RELEASE", "WITHDRAWAL_REVERSAL", "ADMIN_CREDIT", "ADMIN_DEBIT", "ORDER_REFUND_ADJUSTMENT", "OTHER"];
const DIRECTIONS: readonly LedgerDirection[] = ["CREDIT", "DEBIT"];
const encoder = new TextEncoder();

export type WalletLedgerFilters = {
  page: number;
  limit: number;
  member?: string;
  direction?: LedgerDirection;
  type?: WalletTransactionType;
  from?: Date;
  to?: Date;
  reference?: string;
  minAmountMinor?: bigint;
  maxAmountMinor?: bigint;
};

type LedgerTransaction = IWalletTransaction & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
type MemberSummary = { memberNumber: string; name: string };

const compact = (value: string | null, max = 100) => value?.trim().slice(0, max) || undefined;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseNumber(value: string | null, fallback: number) {
  return value === null ? fallback : /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function parseAmount(value: string | null, label: string) {
  if (!value) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw errors.badRequest(`${label} must be a non-negative amount with up to two decimal places.`);
  return decimalToMinorUnits(value);
}

function parseDate(value: string | null, label: string, endOfDay = false) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw errors.badRequest(`${label} must be a valid date.`);
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime())) throw errors.badRequest(`${label} must be a valid date.`);
  return date;
}

/** Parses bounded, primitive-only query filters for the immutable platform ledger. */
export function parseWalletLedgerFilters(params: URLSearchParams): WalletLedgerFilters {
  const page = parseNumber(params.get("page"), 1);
  const limit = parseNumber(params.get("limit"), 25);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) {
    throw errors.badRequest("Invalid wallet ledger pagination.");
  }

  const direction = compact(params.get("direction"));
  const type = compact(params.get("type"));
  if (direction && !DIRECTIONS.includes(direction as LedgerDirection)) throw errors.badRequest("Invalid wallet ledger direction.");
  if (type && !TRANSACTION_TYPES.includes(type as WalletTransactionType)) throw errors.badRequest("Invalid wallet ledger transaction type.");

  const from = parseDate(params.get("from"), "Start date");
  const to = parseDate(params.get("to"), "End date", true);
  if (from && to && from > to) throw errors.badRequest("The date range is invalid.");
  const minAmountMinor = parseAmount(params.get("minAmount"), "Minimum amount");
  const maxAmountMinor = parseAmount(params.get("maxAmount"), "Maximum amount");
  if (minAmountMinor !== undefined && maxAmountMinor !== undefined && minAmountMinor > maxAmountMinor) throw errors.badRequest("The amount range is invalid.");

  return {
    page,
    limit,
    ...(compact(params.get("member")) ? { member: compact(params.get("member")) } : {}),
    ...(direction ? { direction: direction as LedgerDirection } : {}),
    ...(type ? { type: type as WalletTransactionType } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(compact(params.get("reference")) ? { reference: compact(params.get("reference")) } : {}),
    ...(minAmountMinor !== undefined ? { minAmountMinor } : {}),
    ...(maxAmountMinor !== undefined ? { maxAmountMinor } : {}),
  };
}

async function matchingMemberIds(member: string) {
  const regex = new RegExp(escapeRegex(member), "i");
  const users = await User.find({ email: regex }).select("_id").limit(1_000).lean();
  const profiles = await MemberProfile.find({
    $or: [
      { memberNumber: regex },
      { referralCode: regex },
      { firstName: regex },
      { lastName: regex },
      { phone: regex },
      ...(users.length ? [{ userId: { $in: users.map((user) => user._id) } }] : []),
    ],
  }).select("_id").limit(1_000).lean();
  return profiles.map((profile) => profile._id);
}

async function buildLedgerQuery(filters: WalletLedgerFilters): Promise<Record<string, unknown>> {
  const clauses: Record<string, unknown>[] = [];
  if (filters.member) {
    const memberProfileIds = await matchingMemberIds(filters.member);
    if (!memberProfileIds.length) return { _id: { $exists: false } };
    clauses.push({ memberProfileId: { $in: memberProfileIds } });
  }
  if (filters.direction) clauses.push({ direction: filters.direction });
  if (filters.type) clauses.push({ type: filters.type });
  if (filters.from || filters.to) clauses.push({ createdAt: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) } });
  if (filters.reference) {
    const regex = new RegExp(escapeRegex(filters.reference), "i");
    clauses.push({ $or: [{ referenceType: regex }, { referenceId: regex }] });
  }
  if (filters.minAmountMinor !== undefined || filters.maxAmountMinor !== undefined) {
    clauses.push({ amountMinor: { ...(filters.minAmountMinor !== undefined ? { $gte: filters.minAmountMinor } : {}), ...(filters.maxAmountMinor !== undefined ? { $lte: filters.maxAmountMinor } : {}) } });
  }
  return clauses.length ? { $and: clauses } : {};
}

async function memberSummaries(profileIds: Types.ObjectId[]) {
  if (!profileIds.length) return new Map<string, MemberSummary>();
  const profiles = await MemberProfile.find({ _id: { $in: profileIds } }).select("memberNumber firstName lastName").lean();
  return new Map(profiles.map((profile) => [String(profile._id), { memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`.trim() }]));
}

function serialize(transaction: LedgerTransaction, members: Map<string, MemberSummary>) {
  const member = members.get(String(transaction.memberProfileId)) ?? null;
  return {
    id: String(transaction._id),
    member,
    memberProfileId: String(transaction.memberProfileId),
    direction: transaction.direction,
    type: transaction.type,
    amountMinor: transaction.amountMinor.toString(),
    currency: transaction.currency,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    description: transaction.description,
    resultingAvailableMinor: transaction.resultingAvailableMinor.toString(),
    resultingHeldMinor: transaction.resultingHeldMinor.toString(),
    createdAt: transaction.createdAt.toISOString(),
  };
}

export type WalletLedgerRow = ReturnType<typeof serialize>;

export async function getWalletLedgerPage(filters: WalletLedgerFilters) {
  const query = await buildLedgerQuery(filters);
  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    WalletTransaction.countDocuments(query),
  ]);
  const members = await memberSummaries(transactions.map((transaction) => transaction.memberProfileId));
  return {
    items: transactions.map((transaction) => serialize(transaction, members)),
    pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}

export async function getWalletLedgerTransaction(id: string) {
  if (!Types.ObjectId.isValid(id)) throw errors.notFound("The wallet ledger transaction was not found.");
  const transaction = await WalletTransaction.findById(id).lean();
  if (!transaction) throw errors.notFound("The wallet ledger transaction was not found.");
  const members = await memberSummaries([transaction.memberProfileId]);
  return serialize(transaction, members);
}

/** Quotes CSV cells so export data cannot be interpreted as a spreadsheet formula. */
export function walletLedgerCsvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvLine(row: WalletLedgerRow) {
  return [
    row.id,
    row.member?.memberNumber ?? "",
    row.member?.name ?? "",
    row.direction,
    row.type,
    row.amountMinor,
    row.currency,
    row.referenceType,
    row.referenceId,
    row.description,
    row.resultingAvailableMinor,
    row.resultingHeldMinor,
    row.createdAt,
  ].map(walletLedgerCsvCell).join(",") + "\n";
}

/** Streams the filtered ledger in batches; exports never materialize the whole collection in browser/server memory. */
export async function createWalletLedgerCsvStream(filters: WalletLedgerFilters) {
  const query = await buildLedgerQuery(filters);
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(["Transaction ID", "Member ID", "Member", "Direction", "Type", "Amount (minor)", "Currency", "Reference Type", "Reference ID", "Description", "Available balance snapshot (minor)", "Reserved balance snapshot (minor)", "Created At"].map(walletLedgerCsvCell).join(",") + "\n"));
        const cursor = WalletTransaction.find(query).sort({ createdAt: -1, _id: -1 }).lean().cursor();
        let batch: LedgerTransaction[] = [];
        const writeBatch = async () => {
          if (!batch.length) return;
          const members = await memberSummaries(batch.map((transaction) => transaction.memberProfileId));
          for (const transaction of batch) controller.enqueue(encoder.encode(csvLine(serialize(transaction, members))));
          batch = [];
        };
        for await (const transaction of cursor) {
          batch.push(transaction as LedgerTransaction);
          if (batch.length === 100) await writeBatch();
        }
        await writeBatch();
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
