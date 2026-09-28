import "server-only";

import type { Types } from "mongoose";

import { DEFAULT_BRANCH_PAGE_SIZE, MAX_BRANCH_PAGE_SIZE, MAX_GENEALOGY_DEPTH, MAX_SEARCH_RESULTS } from "@/config/genealogy";
import { errors } from "@/lib/errors/app-error";
import { MemberProfile, SponsorRelationship } from "@/models";
import { escapeGenealogySearchTerm } from "@/services/genealogy/genealogy-utils";

export type GenealogyNode = { id: string; memberNumber: string; name: string; status: string; joinedAt: Date; directReferralCount: number };
export type DescendantNode = GenealogyNode & { level: number };

function branchLimit(value?: number) { return Math.min(Math.max(value ?? DEFAULT_BRANCH_PAGE_SIZE, 1), MAX_BRANCH_PAGE_SIZE); }
function safeDepth(value?: number) { return Math.min(Math.max(value ?? 1, 1), MAX_GENEALOGY_DEPTH); }

export { levelFromUpline, escapeGenealogySearchTerm } from "@/services/genealogy/genealogy-utils";

async function hydrateNodes(profileIds: Types.ObjectId[]) {
  if (!profileIds.length) return new Map<string, GenealogyNode>();
  const [profiles, directCounts] = await Promise.all([
    MemberProfile.find({ _id: { $in: profileIds } }).select("memberNumber firstName lastName activationStatus joinedAt").lean(),
    SponsorRelationship.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { sponsorMemberProfileId: { $in: profileIds } } }, { $group: { _id: "$sponsorMemberProfileId", count: { $sum: 1 } } }]),
  ]);
  const counts = new Map(directCounts.map((entry) => [String(entry._id), entry.count]));
  return new Map(profiles.map((profile) => [String(profile._id), { id: String(profile._id), memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`, status: profile.activationStatus, joinedAt: profile.joinedAt, directReferralCount: counts.get(String(profile._id)) ?? 0 }]));
}

export async function getMemberByNumber(memberNumber: string) {
  const profile = await MemberProfile.findOne({ memberNumber: memberNumber.toUpperCase() }).lean();
  if (!profile) throw errors.notFound("The requested member was not found.");
  return profile;
}

export async function getSponsor(memberProfileId: Types.ObjectId) {
  const relationship = await SponsorRelationship.findOne({ memberProfileId }).lean();
  if (!relationship) return null;
  const nodes = await hydrateNodes([relationship.sponsorMemberProfileId]);
  return nodes.get(String(relationship.sponsorMemberProfileId)) ?? null;
}

export async function getDirectChildren(memberProfileId: Types.ObjectId, page = 1, limit?: number) {
  const safePage = Math.max(1, page); const safeLimit = branchLimit(limit);
  const [relations, total] = await Promise.all([
    SponsorRelationship.find({ sponsorMemberProfileId: memberProfileId }).sort({ createdAt: -1, _id: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    SponsorRelationship.countDocuments({ sponsorMemberProfileId: memberProfileId }),
  ]);
  const nodes = await hydrateNodes(relations.map((relation) => relation.memberProfileId));
  return { children: relations.flatMap((relation) => { const node = nodes.get(String(relation.memberProfileId)); return node ? [node] : []; }), page: safePage, limit: safeLimit, total, hasMore: safePage * safeLimit < total };
}

export async function getAncestors(memberProfileId: Types.ObjectId, depth?: number) {
  const relationship = await SponsorRelationship.findOne({ memberProfileId }).lean();
  if (!relationship) return [];
  const ids = relationship.uplineMemberProfileIds.slice(0, safeDepth(depth));
  const nodes = await hydrateNodes(ids);
  return ids.flatMap((id) => { const node = nodes.get(String(id)); return node ? [node] : []; });
}

export async function getDescendants(memberProfileId: Types.ObjectId, depth?: number, page = 1, limit?: number) {
  const maximumDepth = safeDepth(depth); const safePage = Math.max(page, 1); const safeLimit = branchLimit(limit);
  const relations = await SponsorRelationship.aggregate<{ memberProfileId: Types.ObjectId; uplineMemberProfileIds: Types.ObjectId[]; level: number }>([
    { $match: { uplineMemberProfileIds: memberProfileId } },
    { $addFields: { level: { $add: [{ $indexOfArray: ["$uplineMemberProfileIds", memberProfileId] }, 1] } } },
    { $match: { level: { $lte: maximumDepth } } },
    { $sort: { createdAt: -1, _id: -1 } }, { $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit },
  ]);
  const nodes = await hydrateNodes(relations.map((relation) => relation.memberProfileId));
  return relations.flatMap((relation) => { const node = nodes.get(String(relation.memberProfileId)); return node ? [{ ...node, level: relation.level }] : []; });
}

export async function getTeamCounts(memberProfileId: Types.ObjectId) {
  const [teamCount, directCount, levelCounts] = await Promise.all([
    SponsorRelationship.countDocuments({ uplineMemberProfileIds: memberProfileId }),
    SponsorRelationship.countDocuments({ sponsorMemberProfileId: memberProfileId }),
    SponsorRelationship.aggregate<{ _id: number; count: number }>([{ $match: { uplineMemberProfileIds: memberProfileId } }, { $project: { level: { $add: [{ $indexOfArray: ["$uplineMemberProfileIds", memberProfileId] }, 1] } } }, { $match: { level: { $lte: MAX_GENEALOGY_DEPTH } } }, { $group: { _id: "$level", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  return { directCount, teamCount, levelCounts: levelCounts.map((entry) => ({ level: entry._id, count: entry.count })) };
}

export async function canMemberAccessNode(ownerMemberProfileId: Types.ObjectId, targetMemberProfileId: Types.ObjectId) {
  if (ownerMemberProfileId.equals(targetMemberProfileId)) return true;
  return Boolean(await SponsorRelationship.exists({ memberProfileId: targetMemberProfileId, uplineMemberProfileIds: ownerMemberProfileId }));
}

export async function searchGenealogy(query: string, scopeMemberProfileId?: Types.ObjectId) {
  const term = query.trim();
  if (term.length < 2) return [];
  const safeTerm = escapeGenealogySearchTerm(term);
  const match = { $or: [{ memberNumber: { $regex: safeTerm, $options: "i" } }, { firstName: { $regex: safeTerm, $options: "i" } }, { lastName: { $regex: safeTerm, $options: "i" } }] };
  const candidates = await MemberProfile.find(match).select("memberNumber firstName lastName activationStatus joinedAt").limit(MAX_SEARCH_RESULTS).lean();
  if (!scopeMemberProfileId) return candidates.map((profile) => ({ id: String(profile._id), memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`, status: profile.activationStatus }));
  const candidateIds = candidates.map((profile) => profile._id);
  const allowed = await SponsorRelationship.find({ memberProfileId: { $in: candidateIds }, uplineMemberProfileIds: scopeMemberProfileId }).select("memberProfileId").lean();
  const allowedIds = new Set([String(scopeMemberProfileId), ...allowed.map((relation) => String(relation.memberProfileId))]);
  return candidates.filter((profile) => allowedIds.has(String(profile._id))).map((profile) => ({ id: String(profile._id), memberNumber: profile.memberNumber, name: `${profile.firstName} ${profile.lastName}`, status: profile.activationStatus }));
}

export async function getGenealogyRoot(memberProfileId: Types.ObjectId, page?: number, limit?: number) {
  const nodes = await hydrateNodes([memberProfileId]);
  const root = nodes.get(String(memberProfileId));
  if (!root) throw errors.notFound("The requested member was not found.");
  const [ancestors, branch, counts] = await Promise.all([getAncestors(memberProfileId), getDirectChildren(memberProfileId, page, limit), getTeamCounts(memberProfileId)]);
  return { root, ancestors, branch, counts, maxDepth: MAX_GENEALOGY_DEPTH };
}
