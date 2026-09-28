import "server-only";

import { PERMISSION } from "@/config/permissions";
import { requireAuth, requirePermission } from "@/lib/auth/authorization";
import { errors } from "@/lib/errors/app-error";
import { getMemberProfileByUserId } from "@/services/members/member-profile";
import { MAX_BRANCH_PAGE_SIZE, MAX_GENEALOGY_DEPTH, MAX_GENEALOGY_PAGE } from "@/config/genealogy";

export async function getGenealogyAccess(request: Request) {
  const context = await requireAuth(request);
  const elevated = context.roles.some((role) => role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF");
  if (elevated) await requirePermission(PERMISSION.GENEALOGY.VIEW_ALL, request);
  const profile = elevated ? null : await getMemberProfileByUserId(context.user._id);
  return { elevated, profile, context };
}

export function parsePage(value: string | null) {
  if (value === null) return 1;
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_GENEALOGY_PAGE) throw errors.badRequest("Invalid genealogy page.");
  return page;
}

export function parseLimit(value: string | null) {
  if (value === null) return 12;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BRANCH_PAGE_SIZE) throw errors.badRequest("Invalid genealogy page size.");
  return limit;
}

export function parseDepth(value: string | null) {
  if (value === null) return 1;
  const depth = Number(value);
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > MAX_GENEALOGY_DEPTH) throw errors.badRequest("Invalid genealogy depth.");
  return depth;
}
export function requireMemberNumber(value: string | null) { if (!value || !/^MLM\d{6,}$/i.test(value)) throw errors.badRequest("A valid member ID is required."); return value.toUpperCase(); }
