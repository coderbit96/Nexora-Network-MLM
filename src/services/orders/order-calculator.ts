import type { Types } from "mongoose";

export type RequestedCartItem = { productId: Types.ObjectId; quantity: number };
export type CheckoutProduct = { _id: Types.ObjectId; categoryId: Types.ObjectId; name: string; sku: string; status: string; stockQuantity: number; priceMinor: bigint; salePriceMinor?: bigint; currency: string; pv: bigint; bv: bigint; commissionEligible: boolean };

/** Creates immutable order-item snapshots solely from persisted product data. */
export function buildAuthoritativeOrderSnapshot(requestedItems: RequestedCartItem[], products: CheckoutProduct[], activeCategoryIds: Set<string>) {
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  if (!requestedItems.length) throw new Error("Your cart is empty.");
  const items = requestedItems.map((requested) => {
    const product = productsById.get(String(requested.productId));
    if (!product || product.status !== "ACTIVE" || !activeCategoryIds.has(String(product.categoryId))) throw new Error("One or more cart products are unavailable.");
    if (!Number.isSafeInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > product.stockQuantity) throw new Error(`${product.name} no longer has sufficient stock.`);
    const unitPriceMinor = product.salePriceMinor ?? product.priceMinor;
    return { productId: product._id, sku: product.sku, name: product.name, quantity: requested.quantity, unitPriceMinor, lineTotalMinor: unitPriceMinor * BigInt(requested.quantity), pv: product.commissionEligible ? product.pv : 0n, bv: product.commissionEligible ? product.bv : 0n, commissionEligible: product.commissionEligible };
  });
  const currency = productsById.get(String(requestedItems[0].productId))?.currency;
  if (!currency || items.some((_, index) => productsById.get(String(requestedItems[index].productId))?.currency !== currency)) throw new Error("A cart can only contain products with one currency.");
  return { items, currency, subtotalMinor: items.reduce((total, item) => total + item.lineTotalMinor, 0n) };
}
