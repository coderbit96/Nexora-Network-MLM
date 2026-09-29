import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { CommissionTransaction, MemberProfile, Order, SponsorRelationship, WalletTransaction, Withdrawal } from "@/models";
import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";

import type { ReportName } from "@/config/report-permissions";
export { REPORT_NAMES, type ReportName } from "@/config/report-permissions";

export type ReportFilters = { page: number; limit: number; from?: Date; toExclusive?: Date; memberNumber?: string; status?: string };
export type ReportPage = { items: Array<Record<string, string | number | null>>; pagination: { total: number; page: number; limit: number; totalPages: number } };

function parseDate(value: string, endOfDay: boolean) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) throw errors.badRequest("Dates must be valid ISO dates.");
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const page = Number(params.get("page") ?? 1);
  const limit = Number(params.get("limit") ?? 25);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_INTERACTIVE_PAGE || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw errors.badRequest("Invalid report pagination.");
  const fromValue = params.get("from")?.trim(); const toValue = params.get("to")?.trim();
  const from = fromValue ? parseDate(fromValue, false) : undefined;
  const toExclusive = toValue ? parseDate(toValue, true) : undefined;
  if (from && toExclusive && from >= toExclusive) throw errors.badRequest("The report end date must be after the start date.");
  const memberNumber = params.get("member")?.trim().toUpperCase();
  const status = params.get("status")?.trim().toUpperCase();
  if (memberNumber && !/^MLM\d{6,}$/i.test(memberNumber)) throw errors.badRequest("Member filter must be a valid member ID.");
  if (status && status.length > 60) throw errors.badRequest("Invalid report status filter.");
  return { page, limit, ...(from ? { from } : {}), ...(toExclusive ? { toExclusive } : {}), ...(memberNumber ? { memberNumber } : {}), ...(status ? { status } : {}) };
}

function createdRange(filters: ReportFilters, field = "createdAt") {
  if (!filters.from && !filters.toExclusive) return {};
  return { [field]: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.toExclusive ? { $lt: filters.toExclusive } : {}) } };
}

async function resolveMemberId(memberNumber?: string): Promise<Types.ObjectId | null | undefined> {
  if (!memberNumber) return undefined;
  const member = await MemberProfile.findOne({ memberNumber }).select("_id").lean();
  return member?._id ?? null;
}

async function profileLookup(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map<string, { memberNumber: string; name: string }>();
  const profiles = await MemberProfile.find({ _id: { $in: unique } }).select("memberNumber firstName lastName").lean();
  return new Map(profiles.map((profile) => [String(profile._id), { memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}` }]));
}

function result(items: Array<Record<string, string | number | null>>, total: number, filters: ReportFilters): ReportPage {
  return { items, pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) } };
}

export async function getReportPage(name: ReportName, filters: ReportFilters, includeTotal = true): Promise<ReportPage> {
  const memberProfileId = await resolveMemberId(filters.memberNumber);
  if (memberProfileId === null) return result([], 0, filters);
  const skip = (filters.page - 1) * filters.limit;

  if (name === "members") {
    const query: Record<string, unknown> = { ...createdRange(filters, "joinedAt"), ...(filters.status ? { activationStatus: filters.status } : {}), ...(memberProfileId ? { _id: memberProfileId } : {}) };
    const [rows, total] = await Promise.all([MemberProfile.find(query).sort({ joinedAt: -1, _id: -1 }).skip(skip).limit(filters.limit).populate("userId", "email status").lean(), includeTotal ? MemberProfile.countDocuments(query) : Promise.resolve(0)]);
    return result(rows.map((row) => { const user = row.userId as unknown as { email?: string; status?: string }; return { memberNumber: row.memberNumber, name: `${row.firstName} ${row.lastName}`, email: user?.email ?? null, status: row.activationStatus, accountStatus: user?.status ?? null, joinedAt: row.joinedAt.toISOString() }; }), total, filters);
  }

  if (name === "referrals") {
    const query: Record<string, unknown> = { ...createdRange(filters), ...(memberProfileId ? { $or: [{ memberProfileId }, { sponsorMemberProfileId: memberProfileId }] } : {}) };
    const [rows, total] = await Promise.all([SponsorRelationship.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(filters.limit).lean(), includeTotal ? SponsorRelationship.countDocuments(query) : Promise.resolve(0)]);
    const profiles = await profileLookup(rows.flatMap((row) => [row.memberProfileId, row.sponsorMemberProfileId]));
    return result(rows.map((row) => { const member = profiles.get(String(row.memberProfileId)); const sponsor = profiles.get(String(row.sponsorMemberProfileId)); return { memberNumber: member?.memberNumber ?? null, member: member?.name ?? null, sponsorMemberNumber: sponsor?.memberNumber ?? null, sponsor: sponsor?.name ?? null, uplineDepth: row.uplineMemberProfileIds.length, createdAt: row.createdAt.toISOString() }; }), total, filters);
  }

  if (name === "commissions") {
    const query: Record<string, unknown> = { ...createdRange(filters), ...(filters.status ? { status: filters.status } : {}), ...(memberProfileId ? { recipientMemberProfileId: memberProfileId } : {}) };
    const [rows, total] = await Promise.all([CommissionTransaction.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(filters.limit).lean(), includeTotal ? CommissionTransaction.countDocuments(query) : Promise.resolve(0)]);
    const profiles = await profileLookup(rows.flatMap((row) => [row.recipientMemberProfileId, row.sourceMemberProfileId]));
    return result(rows.map((row) => { const recipient = profiles.get(String(row.recipientMemberProfileId)); const source = profiles.get(String(row.sourceMemberProfileId)); return { recipientMemberNumber: recipient?.memberNumber ?? null, recipient: recipient?.name ?? null, sourceMemberNumber: source?.memberNumber ?? null, sourceMember: source?.name ?? null, type: row.commissionType, level: row.level ?? null, amountMinor: row.amountMinor.toString(), currency: row.currency, status: row.status, createdAt: row.createdAt.toISOString() }; }), total, filters);
  }

  if (name === "wallet-transactions") {
    const query: Record<string, unknown> = { ...createdRange(filters), ...(filters.status ? { type: filters.status } : {}), ...(memberProfileId ? { memberProfileId } : {}) };
    const [rows, total] = await Promise.all([WalletTransaction.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(filters.limit).lean(), includeTotal ? WalletTransaction.countDocuments(query) : Promise.resolve(0)]);
    const profiles = await profileLookup(rows.map((row) => row.memberProfileId));
    return result(rows.map((row) => { const member = profiles.get(String(row.memberProfileId)); return { memberNumber: member?.memberNumber ?? null, member: member?.name ?? null, type: row.type, direction: row.direction, amountMinor: row.amountMinor.toString(), currency: row.currency, reference: `${row.referenceType}:${row.referenceId}`, createdAt: row.createdAt.toISOString() }; }), total, filters);
  }

  if (name === "withdrawals") {
    const query: Record<string, unknown> = { ...createdRange(filters), ...(filters.status ? { status: filters.status } : {}), ...(memberProfileId ? { memberProfileId } : {}) };
    const [rows, total] = await Promise.all([Withdrawal.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(filters.limit).lean(), includeTotal ? Withdrawal.countDocuments(query) : Promise.resolve(0)]);
    const profiles = await profileLookup(rows.map((row) => row.memberProfileId));
    return result(rows.map((row) => { const member = profiles.get(String(row.memberProfileId)); return { memberNumber: member?.memberNumber ?? null, member: member?.name ?? null, amountMinor: row.amountMinor.toString(), currency: row.currency, status: row.status, paymentReference: row.paymentReference ?? null, requestedAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null }; }), total, filters);
  }

  const query: Record<string, unknown> = { ...createdRange(filters), ...(name === "sales" ? { paymentStatus: "SUCCESS" } : {}), ...(filters.status ? { status: filters.status } : {}), ...(memberProfileId ? { memberProfileId } : {}) };
  const [rows, total] = await Promise.all([Order.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(filters.limit).lean(), includeTotal ? Order.countDocuments(query) : Promise.resolve(0)]);
  const profiles = await profileLookup(rows.map((row) => row.memberProfileId));
  return result(rows.map((row) => { const member = profiles.get(String(row.memberProfileId)); return { orderNumber: row.orderNumber, memberNumber: member?.memberNumber ?? null, member: member?.name ?? null, totalMinor: row.totalMinor.toString(), currency: row.currency, orderStatus: row.status, paymentStatus: row.paymentStatus, commissionStatus: row.commissionStatus, createdAt: row.createdAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null }; }), total, filters);
}

const CSV_COLUMNS: Record<ReportName, string[]> = {
  members: ["memberNumber", "name", "email", "status", "accountStatus", "joinedAt"],
  referrals: ["memberNumber", "member", "sponsorMemberNumber", "sponsor", "uplineDepth", "createdAt"],
  commissions: ["recipientMemberNumber", "recipient", "sourceMemberNumber", "sourceMember", "type", "level", "amountMinor", "currency", "status", "createdAt"],
  "wallet-transactions": ["memberNumber", "member", "type", "direction", "amountMinor", "currency", "reference", "createdAt"],
  withdrawals: ["memberNumber", "member", "amountMinor", "currency", "status", "paymentReference", "requestedAt", "completedAt"],
  sales: ["orderNumber", "memberNumber", "member", "totalMinor", "currency", "orderStatus", "paymentStatus", "commissionStatus", "createdAt", "paidAt"],
  orders: ["orderNumber", "memberNumber", "member", "totalMinor", "currency", "orderStatus", "paymentStatus", "commissionStatus", "createdAt", "paidAt"],
};

export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  // Quoting does not stop spreadsheet formula execution for user-entered text.
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Streams page-sized result sets so an export never accumulates an unbounded report in browser or server memory. */
export function createReportCsvStream(name: ReportName, filters: ReportFilters) {
  const encoder = new TextEncoder(); const columns = CSV_COLUMNS[name]; let page = 1; let started = false;
  return new ReadableStream<Uint8Array>({ async pull(controller) {
    if (!started) { controller.enqueue(encoder.encode(`\uFEFF${columns.join(",")}\r\n`)); started = true; }
    const report = await getReportPage(name, { ...filters, page, limit: 100 }, false);
    if (!report.items.length) { controller.close(); return; }
    controller.enqueue(encoder.encode(report.items.map((item) => `${columns.map((column) => csvCell(item[column])).join(",")}\r\n`).join("")));
    page += 1;
  } });
}
