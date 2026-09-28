import { type Model, model, models, Schema } from "mongoose";

import type { IMemberProfile } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const MemberProfileSchema = new Schema<IMemberProfile>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  memberNumber: { type: String, required: true, immutable: true, trim: true, uppercase: true, match: /^MLM\d{6,}$/ },
  referralCode: { type: String, required: true, immutable: true, trim: true, uppercase: true, match: /^[A-Z0-9]{6,32}$/ },
  firstName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  phone: { type: String, trim: true, maxlength: 30 },
  alternatePhone: { type: String, trim: true, maxlength: 30 },
  address: {
    line1: { type: String, trim: true, maxlength: 160 },
    line2: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 24 },
    country: { type: String, trim: true, uppercase: true, minlength: 2, maxlength: 2 },
  },
  activationStatus: { type: String, enum: ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"], default: "PENDING", required: true, index: true },
  joinedAt: { type: Date, required: true, default: () => new Date(), immutable: true },
}, schemaOptions);

MemberProfileSchema.index({ userId: 1 }, { unique: true });
MemberProfileSchema.index({ memberNumber: 1 }, { unique: true });
MemberProfileSchema.index({ referralCode: 1 }, { unique: true });
MemberProfileSchema.index({ activationStatus: 1, createdAt: -1 });
MemberProfileSchema.index({ createdAt: -1 });
MemberProfileSchema.index({ activationStatus: 1, joinedAt: -1 });
MemberProfileSchema.index({ joinedAt: -1 });

export const MemberProfile: Model<IMemberProfile> = (models.MemberProfile as Model<IMemberProfile>) || model<IMemberProfile>("MemberProfile", MemberProfileSchema);
