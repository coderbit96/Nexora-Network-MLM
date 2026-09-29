import assert from "node:assert/strict";
import test from "node:test";

import { calculateCommissionAmount, commissionIdempotencyKey, planCommissions, type CommissionRuleSnapshot } from "@/services/commission/commission-calculator";

const eligibleAt = new Date("2026-01-15T10:00:00.000Z");
const order = { sourceMemberProfileId: "D", orderId: "order-1", orderNumber: "ORD00000001", currency: "INR", subtotalMinor: 10_005n, totalMinor: 11_005n, items: [{ pv: 250n, bv: 400n, quantity: 2, lineTotalMinor: 10_005n, commissionEligible: true }] };
const uplines = [{ memberProfileId: "C", activationStatus: "ACTIVE" }, { memberProfileId: "B", activationStatus: "ACTIVE" }, { memberProfileId: "A", activationStatus: "ACTIVE" }];
const rule = (overrides: Partial<CommissionRuleSnapshot>): CommissionRuleSnapshot => ({ id: "rule", commissionType: "LEVEL", level: 1, calculationBasis: "ORDER_SUBTOTAL", rewardType: "PERCENTAGE", rateBasisPoints: 500, active: true, effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), ...overrides });

test("creates direct referral commission from persisted order subtotal", () => {
  const plans = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "direct", commissionType: "DIRECT", level: undefined, rateBasisPoints: 1_000 })] });
  assert.equal(plans.length, 1); assert.equal(plans[0].recipientMemberProfileId, "C"); assert.equal(plans[0].amountMinor, 1_000n);
});

test("creates a level 1 commission for the nearest upline", () => {
  const plans = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "level-1" })] });
  assert.equal(plans.length, 1); assert.equal(plans[0].recipientMemberProfileId, "C"); assert.equal(plans[0].level, 1);
});

test("creates commission across multiple configured levels", () => {
  const plans = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "l1", level: 1, rateBasisPoints: 500 }), rule({ id: "l2", level: 2, rateBasisPoints: 300 }), rule({ id: "l3", level: 3, rateBasisPoints: 100 })] });
  assert.deepEqual(plans.map((plan) => [plan.recipientMemberProfileId, plan.level, plan.amountMinor]), [["C", 1, 500n], ["B", 2, 300n], ["A", 3, 100n]]);
});

test("skips levels without a configured rule", () => {
  const plans = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "l2", level: 2 })] });
  assert.deepEqual(plans.map((plan) => plan.level), [2]);
});

test("skips inactive and out-of-effect rules", () => {
  const plans = planCommissions({ order, uplines, eligibleAt, rules: [rule({ active: false }), rule({ id: "expired", effectiveTo: new Date("2026-01-10T00:00:00.000Z") })] });
  assert.equal(plans.length, 0);
});

test("skips inactive uplines without shifting their original level positions", () => {
  const plans = planCommissions({ order, eligibleAt, uplines: [{ memberProfileId: "C", activationStatus: "SUSPENDED" }, { memberProfileId: "B", activationStatus: "ACTIVE" }, { memberProfileId: "A", activationStatus: "ACTIVE" }], rules: [rule({ id: "l1", level: 1 }), rule({ id: "l2", level: 2 }), rule({ id: "l3", level: 3 })] });
  assert.deepEqual(plans.map((plan) => [plan.recipientMemberProfileId, plan.level]), [["B", 2], ["A", 3]]);
});

test("returns no commissions for zero eligible business", () => {
  const zeroOrder = { ...order, subtotalMinor: 0n, totalMinor: 0n, items: [{ pv: 0n, bv: 0n, quantity: 1, lineTotalMinor: 0n, commissionEligible: false }] };
  assert.equal(planCommissions({ order: zeroOrder, uplines, eligibleAt, rules: [rule({ id: "direct", commissionType: "DIRECT", level: undefined })] }).length, 0);
});

test("does not pay order-value commissions for ineligible product lines", () => {
  const ineligibleOrder = { ...order, items: [{ pv: 0n, bv: 0n, quantity: 1, lineTotalMinor: 10_005n, commissionEligible: false }] };
  assert.equal(planCommissions({ order: ineligibleOrder, uplines, eligibleAt, rules: [rule({ id: "direct", commissionType: "DIRECT", level: undefined })] }).length, 0);
});

test("uses a stable identity for repeated processing of the same order", () => {
  const [plan] = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "l1" })] });
  assert.equal(commissionIdempotencyKey(plan), commissionIdempotencyKey({ ...plan }));
});

test("concurrent processing plans collide on the same immutable ledger identity", () => {
  const [first] = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "l1" })] }); const [second] = planCommissions({ order, uplines, eligibleAt, rules: [rule({ id: "l1" })] });
  assert.equal(commissionIdempotencyKey(first), commissionIdempotencyKey(second));
});

test("calculates money with integer precision and rounds down to minor units", () => {
  assert.equal(calculateCommissionAmount(10_005n, "PERCENTAGE", 333), 333n);
  assert.equal(calculateCommissionAmount(10_005n, "PERCENTAGE", 1_000), 1_000n);
});

test("handles an incomplete sponsor chain by paying configured available levels only", () => {
  const plans = planCommissions({ order, uplines: [{ memberProfileId: "C", activationStatus: "ACTIVE" }], eligibleAt, rules: [rule({ id: "l1", level: 1 }), rule({ id: "l2", level: 2 })] });
  assert.deepEqual(plans.map((plan) => plan.level), [1]);
});

test("creates no commission when the source member has no sponsor relationship", () => {
  const plans = planCommissions({ order, uplines: [], eligibleAt, rules: [rule({ id: "direct", commissionType: "DIRECT", level: undefined }), rule({ id: "l1", level: 1 })] });
  assert.deepEqual(plans, []);
});
