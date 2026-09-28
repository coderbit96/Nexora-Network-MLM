import "server-only";

import { Types } from "mongoose";

import { errors } from "@/lib/errors/app-error";
import { Category, Product } from "@/models";

/**
 * Checkout/order code must use this lookup rather than any browser-supplied product price,
 * PV, BV, stock, or commission-eligibility values.
 */
export async function getAuthoritativeProductForCheckout(productId: string) {
  if (!Types.ObjectId.isValid(productId)) throw errors.badRequest("Invalid product identifier.");
  const product = await Product.findOne({ _id: productId, status: "ACTIVE" }).lean();
  if (!product || product.stockQuantity < 1) throw errors.badRequest("This product is unavailable.");
  const category = await Category.findOne({ _id: product.categoryId, status: "ACTIVE" }).select("_id").lean();
  if (!category) throw errors.badRequest("This product is unavailable.");
  return {
    productId: product._id,
    sku: product.sku,
    name: product.name,
    unitPriceMinor: product.salePriceMinor ?? product.priceMinor,
    currency: product.currency,
    pv: product.commissionEligible ? product.pv : 0n,
    bv: product.commissionEligible ? product.bv : 0n,
    availableStock: product.stockQuantity,
    commissionEligible: product.commissionEligible,
  };
}
