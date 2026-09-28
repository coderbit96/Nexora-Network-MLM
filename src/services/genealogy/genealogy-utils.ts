import type { Types } from "mongoose";

export function levelFromUpline(uplineMemberProfileIds: Types.ObjectId[], rootMemberProfileId: Types.ObjectId) {
  const index = uplineMemberProfileIds.findIndex((id) => id.equals(rootMemberProfileId));
  return index === -1 ? null : index + 1;
}

/**
 * Treat member-search text as literal text before it is used in a MongoDB
 * regular expression. This keeps user-provided search terms from changing
 * the query semantics or creating expensive regex expressions.
 */
export function escapeGenealogySearchTerm(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
