import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { Order } from "@/models";
import { buildAuthoritativeOrderSnapshot } from "@/services/orders/order-calculator";
import { canTransitionOrder } from "@/services/orders/order-transitions";

const categoryId = new Types.ObjectId(); const productId = new Types.ObjectId();
const product = (overrides: Partial<Parameters<typeof buildAuthoritativeOrderSnapshot>[1][number]> = {}) => ({ _id: productId, categoryId, name: "Authoritative Product", sku: "AUTH-001", status: "ACTIVE", stockQuantity: 5, priceMinor: 12_345n, salePriceMinor: 10_005n, currency: "INR", pv: 20n, bv: 30n, commissionEligible: true, ...overrides });

test("checkout snapshots persisted price and ignores browser price tampering", () => {
  // Requested items intentionally carry no price, PV, BV, or stock fields.
  const snapshot = buildAuthoritativeOrderSnapshot([{ productId, quantity: 2 }], [product()], new Set([String(categoryId)]));
  assert.equal(snapshot.items[0].unitPriceMinor, 10_005n);
  assert.equal(snapshot.items[0].lineTotalMinor, 20_010n);
  assert.equal(snapshot.items[0].pv, 20n);
  assert.equal(snapshot.items[0].commissionEligible, true);
  assert.equal(snapshot.subtotalMinor, 20_010n);
});

test("checkout snapshots catalogue commission eligibility", () => {
  const snapshot = buildAuthoritativeOrderSnapshot([{ productId, quantity: 1 }], [product({ commissionEligible: false })], new Set([String(categoryId)]));
  assert.equal(snapshot.items[0].commissionEligible, false);
  assert.equal(snapshot.items[0].pv, 0n);
  assert.equal(snapshot.items[0].bv, 0n);
});

test("captured order lines remain unchanged when the catalogue product later changes", () => {
  const original = buildAuthoritativeOrderSnapshot([{ productId, quantity: 1 }], [product()], new Set([String(categoryId)]));
  const changedCatalogue = buildAuthoritativeOrderSnapshot([{ productId, quantity: 1 }], [product({ name: "Repriced Product", sku: "AUTH-002", priceMinor: 99_999n, salePriceMinor: undefined, pv: 99n, bv: 199n })], new Set([String(categoryId)]));

  assert.deepEqual(original.items[0], {
    productId,
    sku: "AUTH-001",
    name: "Authoritative Product",
    quantity: 1,
    unitPriceMinor: 10_005n,
    lineTotalMinor: 10_005n,
    pv: 20n,
    bv: 30n,
    commissionEligible: true,
  });
  assert.equal(changedCatalogue.items[0].unitPriceMinor, 99_999n);
  assert.equal(changedCatalogue.items[0].name, "Repriced Product");
});

test("checkout rejects invalid, inactive, and insufficient-stock products", () => {
  assert.throws(() => buildAuthoritativeOrderSnapshot([{ productId: new Types.ObjectId(), quantity: 1 }], [product()], new Set([String(categoryId)])), /unavailable/);
  assert.throws(() => buildAuthoritativeOrderSnapshot([{ productId, quantity: 1 }], [product({ status: "INACTIVE" })], new Set([String(categoryId)])), /unavailable/);
  assert.throws(() => buildAuthoritativeOrderSnapshot([{ productId, quantity: 6 }], [product()], new Set([String(categoryId)])), /sufficient stock/);
});

test("order state transitions forbid skipping payment verification and fulfillment steps", () => {
  assert.equal(canTransitionOrder("PAYMENT_PENDING", "PAID"), true);
  assert.equal(canTransitionOrder("PAYMENT_PENDING", "SHIPPED"), false);
  assert.equal(canTransitionOrder("PAID", "PROCESSING"), true);
  assert.equal(canTransitionOrder("PROCESSING", "DELIVERED"), false);
  assert.equal(canTransitionOrder("SHIPPED", "DELIVERED"), true);
});

test("checkout idempotency is protected by a member-scoped order key", () => {
  const indexes = Order.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  assert.equal(indexes.some(([keys, options]) => "memberProfileId" in keys && "checkoutIdempotencyKey" in keys && options.unique === true), true);
});
