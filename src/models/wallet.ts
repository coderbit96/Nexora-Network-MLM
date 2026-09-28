import { type Model, model, models, Schema } from "mongoose";

import type { IWallet } from "@/types/domain";
import { nonNegativeBigInt, schemaOptions } from "./model-utils";

const WalletSchema = new Schema<IWallet>({
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  currency: { type: String, required: true, trim: true, uppercase: true, immutable: true, match: /^[A-Z]{3}$/ },
  availableMinor: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "Available balance cannot be negative." } },
  heldMinor: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "Held balance cannot be negative." } },
  lifetimeCreditMinor: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "Lifetime credit cannot be negative." } },
  lifetimeDebitMinor: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "Lifetime debit cannot be negative." } },
  lifetimeEarningsMinor: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "Lifetime earnings cannot be negative." } },
  lifetimeWithdrawalsMinor: { type: Schema.Types.BigInt, required: true, default: 0n, validate: { validator: nonNegativeBigInt, message: "Lifetime withdrawals cannot be negative." } },
}, schemaOptions);
WalletSchema.index({ memberProfileId: 1, currency: 1 }, { unique: true });
WalletSchema.index({ memberProfileId: 1, updatedAt: -1 });
export const Wallet: Model<IWallet> = (models.Wallet as Model<IWallet>) || model<IWallet>("Wallet", WalletSchema);
