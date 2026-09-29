import "server-only";

import { startSession, Types } from "mongoose";

import { MAX_INTERACTIVE_PAGE } from "@/config/pagination";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import type { AdminMemberProfileUpdateInput, AdminMemberStatusInput } from "@/lib/validation/member";
import { AuditLog, CommissionTransaction, MemberProfile, Order, SponsorRelationship, User, Wallet, Withdrawal } from "@/models";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";
import type { AccountStatus, MemberActivationStatus } from "@/types/domain";

const MEMBER_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"] as const;
const MEMBER_SORTS = ["newest", "oldest", "name_asc", "name_desc"] as const;
type MemberSort = (typeof MEMBER_SORTS)[number];

export type MemberListFilters = { page: number; limit: number; q?: string; status?: (typeof MEMBER_STATUSES)[number]; sponsor?: string; from?: Date; to?: Date; sort: MemberSort };
export type MemberDataAccess = { network: boolean; financials: boolean; orders: boolean; audit: boolean };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compact = (value: string | null) => value?.trim().slice(0, 100) || undefined;

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw errors.badRequest("Dates must use YYYY-MM-DD format.");
  const parsed = new Date(`${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`);
  if (Number.isNaN(parsed.getTime())) throw errors.badRequest("Invalid date filter.");
  return parsed;
}

/** A bounded, allow-listed parser shared by the list route and regression tests. */
export function parseMemberListFilters(searchParams: URLSearchParams): MemberListFilters {
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || page > MAX_INTERACTIVE_PAGE || limit < 1 || limit > 100) throw errors.badRequest("Invalid pagination.");
  const requestedStatus = compact(searchParams.get("status"));
  if (requestedStatus && !MEMBER_STATUSES.includes(requestedStatus as (typeof MEMBER_STATUSES)[number])) throw errors.badRequest("Invalid member status.");
  const requestedSort = compact(searchParams.get("sort")) ?? "newest";
  if (!MEMBER_SORTS.includes(requestedSort as MemberSort)) throw errors.badRequest("Invalid member sort.");
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"), true);
  if (from && to && from > to) throw errors.badRequest("The join-date range is invalid.");
  return { page, limit, ...(compact(searchParams.get("q")) ? { q: compact(searchParams.get("q")) } : {}), ...(requestedStatus ? { status: requestedStatus as MemberListFilters["status"] } : {}), ...(compact(searchParams.get("sponsor")) ? { sponsor: compact(searchParams.get("sponsor")) } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort: requestedSort as MemberSort };
}

function profileName(member: { firstName: string; lastName: string }) { return `${member.firstName} ${member.lastName}`.trim(); }
function stringifyMoney(value: bigint | number | undefined) { return value == null ? "0" : value.toString(); }

async function resolveSponsorMemberIds(sponsor: string) {
  const regex = new RegExp(escapeRegex(sponsor), "i");
  const sponsors = await MemberProfile.find({ $or: [{ memberNumber: regex }, { referralCode: regex }, { firstName: regex }, { lastName: regex }] }).select("_id").limit(500).lean();
  if (!sponsors.length) return [] as Types.ObjectId[];
  const relationships = await SponsorRelationship.find({ sponsorMemberProfileId: { $in: sponsors.map((row) => row._id) } }).select("memberProfileId").limit(10_000).lean();
  return relationships.map((row) => row.memberProfileId);
}

export class MemberManagementService {
  static async list(filters: MemberListFilters, includeNetwork = false) {
    await connectToDatabase();
    const clauses: Record<string, unknown>[] = [];
    if (filters.status) clauses.push({ activationStatus: filters.status });
    if (filters.from || filters.to) clauses.push({ joinedAt: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) } });
    if (filters.sponsor) {
      const ids = await resolveSponsorMemberIds(filters.sponsor);
      if (!ids.length) return { items: [], pagination: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
      clauses.push({ _id: { $in: ids } });
    }
    if (filters.q) {
      const regex = new RegExp(escapeRegex(filters.q), "i");
      const matchingUsers = await User.find({ email: regex }).select("_id").limit(1_000).lean();
      clauses.push({ $or: [{ memberNumber: regex }, { referralCode: regex }, { firstName: regex }, { lastName: regex }, { phone: regex }, { alternatePhone: regex }, ...(matchingUsers.length ? [{ userId: { $in: matchingUsers.map((user) => user._id) } }] : [])] });
    }
    const query = clauses.length ? { $and: clauses } : {};
    const sort: Record<string, 1 | -1> = filters.sort === "oldest" ? { joinedAt: 1, _id: 1 } : filters.sort === "name_asc" ? { firstName: 1, lastName: 1, _id: 1 } : filters.sort === "name_desc" ? { firstName: -1, lastName: -1, _id: -1 } : { joinedAt: -1, _id: -1 };
    const [members, total] = await Promise.all([
      MemberProfile.find(query).sort(sort).skip((filters.page - 1) * filters.limit).limit(filters.limit).populate("userId", "email status").lean(),
      MemberProfile.countDocuments(query),
    ]);
    const memberIds = members.map((member) => member._id);
    const [relations, directCounts, teamCounts] = await Promise.all([
      includeNetwork && memberIds.length ? SponsorRelationship.find({ memberProfileId: { $in: memberIds } }).select("memberProfileId sponsorMemberProfileId").lean() : [],
      includeNetwork && memberIds.length ? SponsorRelationship.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { sponsorMemberProfileId: { $in: memberIds } } }, { $group: { _id: "$sponsorMemberProfileId", count: { $sum: 1 } } }]) : [],
      includeNetwork && memberIds.length ? SponsorRelationship.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { uplineMemberProfileIds: { $in: memberIds } } }, { $unwind: "$uplineMemberProfileIds" }, { $match: { uplineMemberProfileIds: { $in: memberIds } } }, { $group: { _id: "$uplineMemberProfileIds", count: { $sum: 1 } } }]) : [],
    ]);
    const sponsorIds = relations.map((relation) => relation.sponsorMemberProfileId);
    const sponsors = sponsorIds.length ? await MemberProfile.find({ _id: { $in: sponsorIds } }).select("memberNumber firstName lastName").lean() : [];
    const sponsorById = new Map(sponsors.map((sponsor) => [String(sponsor._id), sponsor]));
    const sponsorForMember = new Map(relations.map((relation) => [String(relation.memberProfileId), sponsorById.get(String(relation.sponsorMemberProfileId))]));
    const directById = new Map(directCounts.map((row) => [String(row._id), row.count]));
    const teamById = new Map(teamCounts.map((row) => [String(row._id), row.count]));
    return {
      items: members.map((member) => {
        const user = member.userId as unknown as { email?: string; status?: string };
        const sponsor = sponsorForMember.get(String(member._id));
        return { id: String(member._id), memberNumber: member.memberNumber, name: profileName(member), email: user?.email ?? "—", phone: member.phone ?? "—", referralCode: member.referralCode, sponsor: includeNetwork && sponsor ? { memberNumber: sponsor.memberNumber, name: profileName(sponsor) } : null, status: member.activationStatus, accountStatus: user?.status ?? "—", directReferrals: includeNetwork ? directById.get(String(member._id)) ?? 0 : null, teamSize: includeNetwork ? teamById.get(String(member._id)) ?? 0 : null, joinedAt: member.joinedAt.toISOString() };
      }),
      pagination: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
    };
  }

  static async detail(id: string, access: MemberDataAccess = { network: true, financials: true, orders: true, audit: true }) {
    if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid member identifier.");
    await connectToDatabase();
    const member = await MemberProfile.findById(id).populate("userId", "email status displayName").lean();
    if (!member) throw errors.notFound("Member was not found.");
    const memberId = member._id;
    const [relationship, directRelations, directCount, teamCount, wallet, withdrawalSummary, orderSummary, lifetimeCommission, withdrawals, orders, commissions, activity] = await Promise.all([
      access.network ? SponsorRelationship.findOne({ memberProfileId: memberId }).lean() : null,
      access.network ? SponsorRelationship.find({ sponsorMemberProfileId: memberId }).sort({ createdAt: -1 }).limit(25).lean() : [],
      access.network ? SponsorRelationship.countDocuments({ sponsorMemberProfileId: memberId }) : 0,
      access.network ? SponsorRelationship.countDocuments({ uplineMemberProfileIds: memberId }) : 0,
      access.financials ? Wallet.findOne({ memberProfileId: memberId }).lean() : null,
      access.financials ? Withdrawal.aggregate<{ _id: string; count: number; amountMinor: bigint }>([{ $match: { memberProfileId: memberId } }, { $group: { _id: "$status", count: { $sum: 1 }, amountMinor: { $sum: "$amountMinor" } } }]) : [],
      access.orders ? Order.aggregate<{ count: number; totalMinor: bigint }>([{ $match: { memberProfileId: memberId } }, { $group: { _id: null, count: { $sum: 1 }, totalMinor: { $sum: "$totalMinor" } } }]) : [],
      access.financials ? CommissionTransaction.aggregate<{ amountMinor: bigint }>([{ $match: { recipientMemberProfileId: memberId, status: { $in: ["PENDING", "APPROVED"] } } }, { $group: { _id: null, amountMinor: { $sum: "$amountMinor" } } }]) : [],
      access.financials ? Withdrawal.find({ memberProfileId: memberId }).sort({ createdAt: -1 }).limit(20).lean() : [],
      access.orders ? Order.find({ memberProfileId: memberId }).sort({ createdAt: -1 }).limit(20).lean() : [],
      access.financials ? CommissionTransaction.find({ recipientMemberProfileId: memberId }).sort({ createdAt: -1 }).limit(20).lean() : [],
      access.audit ? AuditLog.find({ resourceId: id }).sort({ createdAt: -1 }).limit(30).lean() : [],
    ]);
    const relationMemberIds = [...directRelations.map((row) => row.memberProfileId), ...(relationship ? [relationship.sponsorMemberProfileId] : [])];
    const relatedProfiles = relationMemberIds.length ? await MemberProfile.find({ _id: { $in: relationMemberIds } }).select("memberNumber firstName lastName activationStatus joinedAt").lean() : [];
    const relatedById = new Map(relatedProfiles.map((profile) => [String(profile._id), profile]));
    const sponsor = relationship ? relatedById.get(String(relationship.sponsorMemberProfileId)) : undefined;
    const withdrawalsByStatus = new Map(withdrawalSummary.map((row) => [row._id, { count: row.count, amountMinor: stringifyMoney(row.amountMinor) }]));
    const orderTotals = orderSummary[0] ?? { count: 0, totalMinor: 0n };
    const user = member.userId as unknown as { email?: string; status?: string };
    return {
      access,
      overview: { id: String(member._id), memberNumber: member.memberNumber, referralCode: member.referralCode, name: profileName(member), email: user?.email ?? "—", phone: member.phone ?? "—", status: member.activationStatus, accountStatus: user?.status ?? "—", joinedAt: member.joinedAt.toISOString(), sponsor: sponsor ? { memberNumber: sponsor.memberNumber, name: profileName(sponsor) } : null, directReferrals: directCount, teamCount, ...(access.financials ? { walletBalanceMinor: stringifyMoney(wallet?.availableMinor), walletHeldMinor: stringifyMoney(wallet?.heldMinor), currency: wallet?.currency ?? "INR", lifetimeEarningsMinor: stringifyMoney(wallet?.lifetimeEarningsMinor ?? lifetimeCommission[0]?.amountMinor), withdrawalSummary: { total: withdrawalSummary.reduce((sum, row) => sum + row.count, 0), pending: withdrawalsByStatus.get("PENDING") ?? { count: 0, amountMinor: "0" }, completed: withdrawalsByStatus.get("COMPLETED") ?? { count: 0, amountMinor: "0" } } } : {}), ...(access.orders ? { orderSummary: { count: orderTotals.count, totalMinor: stringifyMoney(orderTotals.totalMinor) } } : {}) },
      profile: { firstName: member.firstName, lastName: member.lastName, phone: member.phone ?? "", alternatePhone: member.alternatePhone ?? "", address: member.address ?? null },
      sponsorNetwork: { sponsor: sponsor ? { memberNumber: sponsor.memberNumber, name: profileName(sponsor), status: sponsor.activationStatus } : null, directReferrals: directRelations.flatMap((relation) => { const profile = relatedById.get(String(relation.memberProfileId)); return profile ? [{ id: String(profile._id), memberNumber: profile.memberNumber, name: profileName(profile), status: profile.activationStatus, joinedAt: profile.joinedAt.toISOString() }] : []; }), uplineMemberIds: relationship?.uplineMemberProfileIds.map(String) ?? [] },
      wallet: wallet ? { currency: wallet.currency, availableMinor: stringifyMoney(wallet.availableMinor), heldMinor: stringifyMoney(wallet.heldMinor), lifetimeEarningsMinor: stringifyMoney(wallet.lifetimeEarningsMinor), lifetimeWithdrawalsMinor: stringifyMoney(wallet.lifetimeWithdrawalsMinor) } : null,
      withdrawals: withdrawals.map((row) => ({ id: String(row._id), amountMinor: stringifyMoney(row.amountMinor), currency: row.currency, status: row.status, createdAt: row.createdAt.toISOString() })),
      orders: orders.map((row) => ({ id: String(row._id), orderNumber: row.orderNumber, totalMinor: stringifyMoney(row.totalMinor), currency: row.currency, status: row.status, paymentStatus: row.paymentStatus, createdAt: row.createdAt.toISOString() })),
      commissions: commissions.map((row) => ({ id: String(row._id), type: row.commissionType, level: row.level ?? null, amountMinor: stringifyMoney(row.amountMinor), currency: row.currency, status: row.status, createdAt: row.createdAt.toISOString() })),
      activity: activity.map((row) => ({ id: String(row._id), action: row.action, resourceType: row.resourceType, createdAt: row.createdAt.toISOString() })),
    };
  }

  static async updateProfile(id: string, input: AdminMemberProfileUpdateInput, actorUserId: Types.ObjectId, audit: AuditRequestContext) {
    if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid member identifier.");
    await connectToDatabase();
    const member = await MemberProfile.findById(id).populate("userId", "firebaseUid displayName").lean();
    if (!member) throw errors.notFound("Member was not found.");
    const user = member.userId as unknown as { _id: Types.ObjectId; firebaseUid: string; displayName: string };
    const displayName = `${input.firstName} ${input.lastName}`.trim();
    if (displayName !== user.displayName) {
      try { await getFirebaseAdminAuth().updateUser(user.firebaseUid, { displayName }); }
      catch { throw errors.conflict("The Firebase identity could not be synchronized."); }
    }
    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const liveMember = await MemberProfile.findById(id).session(session);
        const liveUser = await User.findById(user._id).session(session);
        if (!liveMember || !liveUser) throw errors.notFound("Member was not found.");
        const before = { name: profileName(liveMember), phone: liveMember.phone ?? null, alternatePhone: liveMember.alternatePhone ?? null, address: liveMember.address ?? null };
        liveMember.firstName = input.firstName;
        liveMember.lastName = input.lastName;
        liveMember.phone = input.phone || undefined;
        liveMember.alternatePhone = input.alternatePhone || undefined;
        liveMember.address = input.address ?? undefined;
        liveUser.displayName = displayName;
        await Promise.all([liveMember.save({ session }), liveUser.save({ session })]);
        await AuditService.record({ actorUserId, ...audit, action: "member.profile_updated", resourceType: "MemberProfile", resourceId: id, before, after: { name: displayName, phone: liveMember.phone ?? null, alternatePhone: liveMember.alternatePhone ?? null, address: liveMember.address ?? null } }, session);
      });
    } catch (error) {
      if (displayName !== user.displayName) {
        try { await getFirebaseAdminAuth().updateUser(user.firebaseUid, { displayName: user.displayName }); } catch { /* Preserve original failure without leaking provider details. */ }
      }
      throw error;
    } finally { await session.endSession(); }
  }

  static async changeStatus(id: string, input: AdminMemberStatusInput, actorUserId: Types.ObjectId, audit: AuditRequestContext) {
    if (!Types.ObjectId.isValid(id)) throw errors.badRequest("Invalid member identifier.");
    await connectToDatabase();
    const member = await MemberProfile.findById(id).populate("userId", "firebaseUid status").lean();
    if (!member) throw errors.notFound("Member was not found.");
    const targetUser = member.userId as unknown as { _id: Types.ObjectId; firebaseUid: string; status: AccountStatus };
    const next: { account: AccountStatus; member: MemberActivationStatus; disabled: boolean; action: string } = input.status === "ACTIVE"
      ? { account: "ACTIVE", member: "ACTIVE", disabled: false, action: "member.activated" }
      : input.status === "SUSPENDED"
        ? { account: "SUSPENDED", member: "SUSPENDED", disabled: false, action: "member.suspended" }
        : { account: "DISABLED", member: "INACTIVE", disabled: true, action: "member.disabled" };
    if (targetUser.status === next.account && member.activationStatus === next.member) return;
    try { await getFirebaseAdminAuth().updateUser(targetUser.firebaseUid, { disabled: next.disabled }); }
    catch { throw errors.conflict("The Firebase identity could not be synchronized."); }
    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const [liveMember, liveUser] = await Promise.all([MemberProfile.findById(id).session(session), User.findById(targetUser._id).session(session)]);
        if (!liveMember || !liveUser) throw errors.notFound("Member was not found.");
        const before = { accountStatus: liveUser.status, memberStatus: liveMember.activationStatus };
        liveUser.status = next.account;
        liveMember.activationStatus = next.member;
        await Promise.all([liveUser.save({ session }), liveMember.save({ session })]);
        await AuditService.record({ actorUserId, ...audit, action: next.action, resourceType: "MemberProfile", resourceId: id, before, after: { accountStatus: next.account, memberStatus: next.member }, metadata: { ...(input.reason ? { reason: input.reason } : {}) } }, session);
      });
    } catch (error) {
      try { await getFirebaseAdminAuth().updateUser(targetUser.firebaseUid, { disabled: targetUser.status === "DISABLED" }); } catch { /* Preserve original failure without exposing Firebase details. */ }
      throw error;
    } finally { await session.endSession(); }
  }
}
