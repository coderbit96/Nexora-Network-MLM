import { type Model, model, models, Schema } from "mongoose";

import type { IOrder, IOrderItem } from "@/types/domain";
import { nonNegativeBigInt, schemaOptions } from "./model-utils";

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, immutable: true },
  sku: { type: String, required: true, immutable: true, trim: true, uppercase: true },
  name: { type: String, required: true, immutable: true, trim: true, maxlength: 180 },
  quantity: { type: Number, required: true, immutable: true, min: 1, validate: { validator: Number.isSafeInteger, message: "Quantity must be an integer." } },
  unitPriceMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Unit price cannot be negative." } },
  lineTotalMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Line total cannot be negative." } },
  pv: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "PV cannot be negative." } },
  bv: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "BV cannot be negative." } },
  // Snapshot eligibility so later catalogue edits cannot change an order's commission base.
  commissionEligible: { type: Boolean, required: true, immutable: true },
}, { _id: true, strict: "throw" });

const OrderSchema = new Schema<IOrder>({
  orderNumber: { type: String, required: true, immutable: true, trim: true, uppercase: true, match: /^[A-Z]{2,8}\d{8,}$/ },
  memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true },
  currency: { type: String, required: true, immutable: true, trim: true, uppercase: true, match: /^[A-Z]{3}$/ },
  items: { type: [OrderItemSchema], required: true, immutable: true, validate: { validator: (items: IOrderItem[]) => items.length > 0, message: "An order requires at least one item." } },
  subtotalMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Subtotal cannot be negative." } },
  discountMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Discount cannot be negative." } },
  taxMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Tax cannot be negative." } },
  totalMinor: { type: Schema.Types.BigInt, required: true, immutable: true, validate: { validator: nonNegativeBigInt, message: "Total cannot be negative." } },
  status: { type: String, required: true, enum: ["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"], default: "PENDING", index: true },
  paymentStatus: { type: String, required: true, enum: ["CREATED", "PENDING", "SUCCESS", "FAILED", "REFUNDED"], default: "CREATED", index: true },
  commissionStatus: { type: String, required: true, enum: ["NOT_ELIGIBLE", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "REVERSED"], default: "NOT_ELIGIBLE", index: true },
  checkoutIdempotencyKey: { type: String, required: true, immutable: true, trim: true, maxlength: 200 },
  paidAt: { type: Date },
}, schemaOptions);
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ memberProfileId: 1, createdAt: -1 });
OrderSchema.index({ memberProfileId: 1, checkoutIdempotencyKey: 1 }, { unique: true });
OrderSchema.index({ status: 1, commissionStatus: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, paidAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
export const Order: Model<IOrder> = (models.Order as Model<IOrder>) || model<IOrder>("Order", OrderSchema);
