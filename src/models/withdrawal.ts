import { type Model, model, models, Schema } from "mongoose";

import type { IWithdrawal } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const WithdrawalStatusHistorySchema = new Schema({
  status: { type: String, required: true, enum: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"] },
  changedAt: { type: Date, required: true, default: () => new Date() },
  changedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  note: { type: String, trim: true, maxlength: 500 },
  paymentReference: { type: String, trim: true, maxlength: 160 },
}, { _id: false, strict: "throw" });

const WithdrawalSchema = new Schema<IWithdrawal>({
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true, immutable: true },
  currency: { type: String, required: true, trim: true, uppercase: true, immutable: true, match: /^[A-Z]{3}$/ },
  amountMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: (value: bigint) => value > 0n, message: "Withdrawal amount must be positive." } },
  status: { type: String, required: true, enum: ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"], default: "PENDING", index: true },
  idempotencyKey: { type: String, required: true, immutable: true, trim: true, maxlength: 200 },
  destinationSnapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
  reviewedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date },
  completedAt: { type: Date },
  paymentReference: { type: String, trim: true, maxlength: 160 },
  statusHistory: { type: [WithdrawalStatusHistorySchema], required: true, default: () => [{ status: "PENDING", changedAt: new Date() }] },
}, schemaOptions);
WithdrawalSchema.index({ memberProfileId: 1, status: 1, createdAt: -1 });
WithdrawalSchema.index({ status: 1, updatedAt: -1 });
WithdrawalSchema.index({ status: 1, createdAt: -1 });
WithdrawalSchema.index({ status: 1, completedAt: -1 });
WithdrawalSchema.index({ memberProfileId: 1, idempotencyKey: 1 }, { unique: true });
export const Withdrawal: Model<IWithdrawal> = (models.Withdrawal as Model<IWithdrawal>) || model<IWithdrawal>("Withdrawal", WithdrawalSchema);
