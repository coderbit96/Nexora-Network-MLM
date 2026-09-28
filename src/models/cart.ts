import { type Model, model, models, Schema } from "mongoose";

import type { ICart } from "@/types/domain";
import { schemaOptions } from "./model-utils";

const CartItemSchema = new Schema({ productId: { type: Schema.Types.ObjectId, ref: "Product", required: true }, quantity: { type: Number, required: true, min: 1, max: 100, validate: { validator: Number.isSafeInteger, message: "Quantity must be a whole number." } } }, { _id: false, strict: "throw" });
const CartSchema = new Schema<ICart>({ memberProfileId: { type: Schema.Types.ObjectId, ref: "MemberProfile", required: true, immutable: true }, items: { type: [CartItemSchema], required: true, default: [] } }, schemaOptions);
CartSchema.index({ memberProfileId: 1 }, { unique: true });
export const Cart: Model<ICart> = (models.Cart as Model<ICart>) || model<ICart>("Cart", CartSchema);
