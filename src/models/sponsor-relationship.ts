import { type Model, model, models, Schema } from "mongoose";

import type { ISponsorRelationship } from "@/types/domain";
import { makeImmutable, schemaOptions } from "./model-utils";

const SponsorRelationshipSchema = new Schema<ISponsorRelationship>({
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  sponsorMemberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  // Nearest sponsor first. Materialized ancestry supports efficient upline and cycle checks.
  uplineMemberProfileIds: [{ type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true }],
}, schemaOptions);

SponsorRelationshipSchema.pre("validate", function () {
  const member = this.memberProfileId.toString();
  const sponsor = this.sponsorMemberProfileId.toString();
  const uplines = this.uplineMemberProfileIds.map((id) => id.toString());
  if (member === sponsor || uplines.includes(member)) this.invalidate("sponsorMemberProfileId", "A member cannot sponsor themselves or create a circular upline.");
  if (uplines[0] !== sponsor) this.invalidate("uplineMemberProfileIds", "The first upline member must be the direct sponsor.");
  if (new Set(uplines).size !== uplines.length) this.invalidate("uplineMemberProfileIds", "The upline chain cannot contain duplicates.");
});

SponsorRelationshipSchema.index({ memberProfileId: 1 }, { unique: true });
SponsorRelationshipSchema.index({ sponsorMemberProfileId: 1, createdAt: -1 });
SponsorRelationshipSchema.index({ uplineMemberProfileIds: 1 });
SponsorRelationshipSchema.index({ createdAt: -1 });
makeImmutable(SponsorRelationshipSchema);

export const SponsorRelationship: Model<ISponsorRelationship> = (models.SponsorRelationship as Model<ISponsorRelationship>) || model<ISponsorRelationship>("SponsorRelationship", SponsorRelationshipSchema);
