import { type Model, model, models, Schema } from "mongoose";

import type { IPlacement } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const PlacementSchema = new Schema<IPlacement>({
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  parentMemberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", immutable: true },
  ancestorMemberProfileIds: [{ type: Schema.Types.ObjectId, ref: "MemberProfile", immutable: true }],
}, schemaOptions);

PlacementSchema.pre("validate", function () {
  const member = this.memberProfileId.toString();
  const ancestors = this.ancestorMemberProfileIds.map((id) => id.toString());
  if (this.parentMemberProfileId?.toString() === member || ancestors.includes(member)) this.invalidate("parentMemberProfileId", "Placement cannot reference the member as an ancestor.");
  if (new Set(ancestors).size !== ancestors.length) this.invalidate("ancestorMemberProfileIds", "Placement ancestry cannot contain duplicates.");
});

PlacementSchema.index({ memberProfileId: 1 }, { unique: true });
PlacementSchema.index({ parentMemberProfileId: 1, createdAt: -1 });
PlacementSchema.index({ ancestorMemberProfileIds: 1 });

export const Placement: Model<IPlacement> = (models.Placement as Model<IPlacement>) || model<IPlacement>("Placement", PlacementSchema);
