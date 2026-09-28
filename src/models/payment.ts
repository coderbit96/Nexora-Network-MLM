import { type Model, model, models, Schema } from "mongoose";

import type { IPayment } from "@/types/domain";
import { nonNegativeBigInt, schemaOptions } from "./model-utils";

const PaymentSchema = new Schema<IPayment>({
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, immutable: true },
  provider: { type: String, required: true, trim: true, lowercase: true, immutable: true, maxlength: 60 },
  providerTransactionId: { type: String, trim: true, maxlength: 180 },
  amountMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Payment amount cannot be negative." } },
  currency: { type: String, required: true, immutable: true, trim: true, uppercase: true, match: /^[A-Z]{3}$/ },
  status: { type: String, required: true, enum: ["CREATED", "PENDING", "SUCCESS", "FAILED", "REFUNDED"], default: "CREATED", index: true },
  idempotencyKey: { type: String, required: true, immutable: true, trim: true, maxlength: 200 },
  providerPayload: { type: Schema.Types.Mixed, select: false },
}, schemaOptions);
PaymentSchema.index({ idempotencyKey: 1 }, { unique: true });
PaymentSchema.index({ provider: 1, providerTransactionId: 1 }, { unique: true, partialFilterExpression: { providerTransactionId: { $type: "string" } } });
PaymentSchema.index({ orderId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, updatedAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
export const Payment: Model<IPayment> = (models.Payment as Model<IPayment>) || model<IPayment>("Payment", PaymentSchema);
