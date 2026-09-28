import { type Model, model, models, Schema } from "mongoose";

import type { IPaymentWebhookEvent } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const PaymentWebhookEventSchema = new Schema<IPaymentWebhookEvent>({
  provider: { type: String, required: true, trim: true, lowercase: true, immutable: true, maxlength: 60 },
  eventId: { type: String, required: true, trim: true, immutable: true, maxlength: 200 },
  paymentId: { type: Schema.Types.ObjectId, ref: "Payment", immutable: true },
  status: { type: String, required: true, enum: ["RECEIVED", "PROCESSED", "FAILED"], default: "RECEIVED", index: true },
  payloadHash: { type: String, required: true, immutable: true, maxlength: 128 },
  processedAt: { type: Date },
}, schemaOptions);
PaymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
PaymentWebhookEventSchema.index({ paymentId: 1, createdAt: -1 });
export const PaymentWebhookEvent: Model<IPaymentWebhookEvent> = (models.PaymentWebhookEvent as Model<IPaymentWebhookEvent>) || model<IPaymentWebhookEvent>("PaymentWebhookEvent", PaymentWebhookEventSchema);
