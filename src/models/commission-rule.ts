import { type Model, model, models, Schema } from "mongoose";

import type { ICommissionRule } from "@/types/domain";
import { nonNegativeBigInt, schemaOptions } from "./model-utils";

const CommissionRuleSchema = new Schema<ICommissionRule>({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  commissionType: { type: String, required: true, enum: ["DIRECT", "LEVEL"], index: true },
  level: { type: Number, min: 1, max: 100 },
  calculationBasis: { type: String, required: true, enum: ["ORDER_SUBTOTAL", "ORDER_TOTAL", "PV", "BV"] },
  rewardType: { type: String, required: true, enum: ["PERCENTAGE", "FIXED"] },
  rateBasisPoints: { type: Number, min: 1, max: 10_000 },
  fixedAmountMinor: { type: Schema.Types.BigInt, validate: { validator: nonNegativeBigInt, message: "Fixed commission cannot be negative." } },
  active: { type: Boolean, required: true, default: true, index: true },
  effectiveFrom: { type: Date, required: true, default: () => new Date(), index: true },
  effectiveTo: { type: Date },
}, schemaOptions);
CommissionRuleSchema.pre("validate", function () {
  if (this.commissionType === "DIRECT" && this.level != null) this.invalidate("level", "Direct commission rules cannot define a level.");
  if (this.commissionType === "LEVEL" && !this.level) this.invalidate("level", "Level commission rules require a level.");
  if (this.rewardType === "PERCENTAGE" && !this.rateBasisPoints) this.invalidate("rateBasisPoints", "Percentage rules require basis points.");
  if (this.rewardType === "FIXED" && this.fixedAmountMinor == null) this.invalidate("fixedAmountMinor", "Fixed rules require an amount.");
  if (this.effectiveTo && this.effectiveTo <= this.effectiveFrom) this.invalidate("effectiveTo", "Effective end time must be after the start time.");
});
CommissionRuleSchema.index({ commissionType: 1, level: 1, effectiveFrom: 1 }, { unique: true });
CommissionRuleSchema.index({ active: 1, commissionType: 1, level: 1, effectiveFrom: -1 });
export const CommissionRule: Model<ICommissionRule> = (models.CommissionRule as Model<ICommissionRule>) || model<ICommissionRule>("CommissionRule", CommissionRuleSchema);
