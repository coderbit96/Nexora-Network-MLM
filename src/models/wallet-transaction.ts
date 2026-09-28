import { type Model, model, models, Schema } from "mongoose";

import type { IWalletTransaction } from "@/types/domain";
import { makeImmutable, nonNegativeBigInt, positiveBigInt, schemaOptions } from "./model-utils";

const WalletTransactionSchema = new Schema<IWalletTransaction>({
  walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true, immutable: true },
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  currency: { type: String, required: true, trim: true, uppercase: true, immutable: true, match: /^[A-Z]{3}$/ },
  type: { type: String, required: true, enum: ["DIRECT_COMMISSION", "LEVEL_COMMISSION", "WITHDRAWAL_RESERVATION", "WITHDRAWAL", "WITHDRAWAL_RELEASE", "WITHDRAWAL_REVERSAL", "ADMIN_CREDIT", "ADMIN_DEBIT", "ORDER_REFUND_ADJUSTMENT", "OTHER"], immutable: true },
  direction: { type: String, required: true, enum: ["CREDIT", "DEBIT"], immutable: true },
  amountMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: positiveBigInt, message: "Ledger amount must be greater than zero." } },
  resultingAvailableMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Resulting available balance cannot be negative." } },
  resultingHeldMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Resulting held balance cannot be negative." } },
  referenceType: { type: String, required: true, trim: true, immutable: true, maxlength: 80 },
  referenceId: { type: String, required: true, trim: true, immutable: true, maxlength: 120 },
  idempotencyKey: { type: String, required: true, trim: true, immutable: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, immutable: true, maxlength: 500 },
  metadata: { type: Schema.Types.Mixed, immutable: true },
}, schemaOptions);
WalletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
WalletTransactionSchema.index({ memberProfileId: 1, createdAt: -1 });
WalletTransactionSchema.index({ type: 1, createdAt: -1 });
WalletTransactionSchema.index({ createdAt: -1 });
WalletTransactionSchema.index({ referenceType: 1, referenceId: 1 });
makeImmutable(WalletTransactionSchema);
export const WalletTransaction: Model<IWalletTransaction> = (models.WalletTransaction as Model<IWalletTransaction>) || model<IWalletTransaction>("WalletTransaction", WalletTransactionSchema);
