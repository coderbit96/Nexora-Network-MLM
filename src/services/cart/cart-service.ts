import "server-only";

import type { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { Cart, Product } from "@/models";

export class CartService {
  static async get(memberProfileId: Types.ObjectId) { return Cart.findOneAndUpdate({ memberProfileId }, { $setOnInsert: { memberProfileId, items: [] } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); }

  static async setItem(memberProfileId: Types.ObjectId, productId: string, quantity: number) {
    const product = await Product.findOne({ _id: productId, status: "ACTIVE" }).select("_id stockQuantity").lean();
    if (!product) throw errors.badRequest("This product is unavailable.");
    if (quantity > product.stockQuantity) throw errors.badRequest("Requested quantity exceeds current stock.");
    const cart = await CartService.get(memberProfileId); const items = cart.items.filter((item) => String(item.productId) !== productId);
    if (quantity > 0) items.push({ productId: product._id, quantity });
    return Cart.findByIdAndUpdate(cart._id, { $set: { items } }, { new: true, runValidators: true }).lean();
  }

  static async removeItem(memberProfileId: Types.ObjectId, productId: string) {
    const cart = await CartService.get(memberProfileId); const items = cart.items.filter((item) => String(item.productId) !== productId);
    return Cart.findByIdAndUpdate(cart._id, { $set: { items } }, { new: true, runValidators: true }).lean();
  }
}
