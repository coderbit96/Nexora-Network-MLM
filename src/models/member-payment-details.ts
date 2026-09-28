import { type Model, model, models, Schema } from "mongoose";

import type { IMemberPaymentDetails } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const MemberPaymentDetailsSchema = new Schema<IMemberPaymentDetails>({
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  accountHolderNameEncrypted: { type: String, required: true, select: false },
  bankNameEncrypted: { type: String, required: true, select: false },
  accountNumberEncrypted: { type: String, required: true, select: false },
  ifscCodeEncrypted: { type: String, required: true, select: false },
  accountLast4: { type: String, required: true, match: /^\d{4}$/ },
}, schemaOptions);

MemberPaymentDetailsSchema.index({ memberProfileId: 1 }, { unique: true });
export const MemberPaymentDetails: Model<IMemberPaymentDetails> = (models.MemberPaymentDetails as Model<IMemberPaymentDetails>) || model<IMemberPaymentDetails>("MemberPaymentDetails", MemberPaymentDetailsSchema);
