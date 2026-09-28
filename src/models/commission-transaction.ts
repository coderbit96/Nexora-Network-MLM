import { type Model, model, models, Schema } from "mongoose";

import type { ICommissionTransaction } from "@/types/domain";
import { makeImmutable, nonNegativeBigInt, schemaOptions } from "./model-utils";

const CommissionTransactionSchema = new Schema<ICommissionTransaction>({
  recipientMemberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  sourceMemberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  sourceReferenceType: { type: String, required: true, enum: ["ORDER"], immutable: true },
  sourceReferenceId: { type: String, required: true, trim: true, immutable: true, maxlength: 120 },
  sourceOrderId: { type: Schema.Types.ObjectId, ref: "Order", immutable: true },
  commissionRuleId: { type: Schema.Types.ObjectId, ref: "CommissionRule", required: true, immutable: true },
  ruleEffectiveFrom: { type: Date, required: true, immutable: true },
  commissionType: { type: String, required: true, enum: ["DIRECT", "LEVEL"], immutable: true },
  level: { type: Number, min: 1, max: 100, immutable: true },
  calculationBasis: { type: String, required: true, enum: ["ORDER_SUBTOTAL", "ORDER_TOTAL", "PV", "BV"], immutable: true },
  rewardType: { type: String, required: true, enum: ["PERCENTAGE", "FIXED"], immutable: true },
  rateBasisPoints: { type: Number, min: 1, max: 10_000, immutable: true },
  fixedAmountMinor: { type: Schema.Types.BigInt, immutable: true, validate: { validator: nonNegativeBigInt, message: "Fixed commission cannot be negative." } },
  currency: { type: String, required: true, trim: true, uppercase: true, immutable: true, match: /^[A-Z]{3}$/ },
  baseAmountMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Commission base cannot be negative." } },
  amountMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Commission amount cannot be negative." } },
  status: { type: String, required: true, enum: ["PENDING", "APPROVED", "REVERSED", "VOID"], default: "PENDING", immutable: true },
  walletTransactionId: { type: Schema.Types.ObjectId, ref: "WalletTransaction", immutable: true },
}, schemaOptions);
CommissionTransactionSchema.pre("validate", function () {
  if (this.commissionType === "DIRECT" && this.level != null) this.invalidate("level", "Direct commissions cannot specify a level.");
  if (this.commissionType === "LEVEL" && !this.level) this.invalidate("level", "Level commissions require a level.");
  if (this.rewardType === "PERCENTAGE" && !this.rateBasisPoints) this.invalidate("rateBasisPoints", "Percentage commissions require the applied rate.");
  if (this.rewardType === "FIXED" && this.fixedAmountMinor == null) this.invalidate("fixedAmountMinor", "Fixed commissions require the applied amount.");
});
// One applied rule may grant exactly one entitlement to a member for a source order/reference.
CommissionTransactionSchema.index({ sourceReferenceType: 1, sourceReferenceId: 1, recipientMemberProfileId: 1, commissionRuleId: 1 }, { unique: true });
CommissionTransactionSchema.index({ recipientMemberProfileId: 1, createdAt: -1 });
CommissionTransactionSchema.index({ status: 1, createdAt: -1 });
CommissionTransactionSchema.index({ createdAt: -1 });
CommissionTransactionSchema.index({ sourceOrderId: 1 });
makeImmutable(CommissionTransactionSchema);
export const CommissionTransaction: Model<ICommissionTransaction> = (models.CommissionTransaction as Model<ICommissionTransaction>) || model<ICommissionTransaction>("CommissionTransaction", CommissionTransactionSchema);
