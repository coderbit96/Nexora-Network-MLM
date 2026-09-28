import type { CommissionCalculationBasis, CommissionRewardType, CommissionType } from "@/types/domain";

export type CommissionableOrder = { sourceMemberProfileId: string; orderId: string; orderNumber: string; currency: string; subtotalMinor: bigint; totalMinor: bigint; items: Array<{ pv: bigint; bv: bigint; quantity: number; lineTotalMinor: bigint; commissionEligible: boolean }> };
export type CommissionRuleSnapshot = { id: string; commissionType: CommissionType; level?: number; calculationBasis: CommissionCalculationBasis; rewardType: CommissionRewardType; rateBasisPoints?: number; fixedAmountMinor?: bigint; active: boolean; effectiveFrom: Date; effectiveTo?: Date };
export type UplineCandidate = { memberProfileId: string; activationStatus: string };
export type PlannedCommission = { recipientMemberProfileId: string; sourceMemberProfileId: string; sourceOrderId: string; sourceReferenceId: string; commissionRuleId: string; ruleEffectiveFrom: Date; commissionType: CommissionType; level?: number; calculationBasis: CommissionCalculationBasis; rewardType: CommissionRewardType; rateBasisPoints?: number; fixedAmountMinor?: bigint; currency: string; baseAmountMinor: bigint; amountMinor: bigint };

const BASIS_POINT_DIVISOR = 10_000n;

export function commissionIdempotencyKey(plan: Pick<PlannedCommission, "sourceOrderId" | "recipientMemberProfileId" | "commissionRuleId">) {
  return `commission:${plan.sourceOrderId}:${plan.recipientMemberProfileId}:${plan.commissionRuleId}`;
}

export function commissionBase(order: CommissionableOrder, basis: CommissionCalculationBasis) {
  const eligibleSubtotalMinor = order.items.reduce((total, item) => total + (item.commissionEligible ? item.lineTotalMinor : 0n), 0n);
  if (basis === "ORDER_SUBTOTAL") return eligibleSubtotalMinor;
  // Order totals may later include taxes/discounts. Allocate those proportionately to eligible
  // lines so ineligible products never inflate an upline commission base.
  if (basis === "ORDER_TOTAL") return order.subtotalMinor > 0n ? eligibleSubtotalMinor * order.totalMinor / order.subtotalMinor : 0n;
  if (basis === "PV") return order.items.reduce((total, item) => total + item.pv * BigInt(item.quantity), 0n);
  return order.items.reduce((total, item) => total + item.bv * BigInt(item.quantity), 0n);
}

export function calculateCommissionAmount(baseAmountMinor: bigint, rewardType: CommissionRewardType, rateBasisPoints?: number, fixedAmountMinor?: bigint) {
  if (baseAmountMinor <= 0n) return 0n;
  if (rewardType === "FIXED") return fixedAmountMinor ?? 0n;
  if (!rateBasisPoints || rateBasisPoints <= 0) return 0n;
  // Integer division intentionally rounds down to the smallest currency unit.
  return baseAmountMinor * BigInt(rateBasisPoints) / BASIS_POINT_DIVISOR;
}

function activeAt(rule: CommissionRuleSnapshot, eligibleAt: Date) {
  return rule.active && rule.effectiveFrom <= eligibleAt && (!rule.effectiveTo || rule.effectiveTo > eligibleAt);
}

function selectRule(rules: CommissionRuleSnapshot[], type: CommissionType, level: number | undefined, eligibleAt: Date) {
  return rules.filter((rule) => rule.commissionType === type && rule.level === level && activeAt(rule, eligibleAt)).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}

function toPlan(order: CommissionableOrder, recipient: UplineCandidate, rule: CommissionRuleSnapshot, level?: number): PlannedCommission | null {
  const baseAmountMinor = commissionBase(order, rule.calculationBasis);
  const amountMinor = calculateCommissionAmount(baseAmountMinor, rule.rewardType, rule.rateBasisPoints, rule.fixedAmountMinor);
  if (amountMinor <= 0n) return null;
  return { recipientMemberProfileId: recipient.memberProfileId, sourceMemberProfileId: order.sourceMemberProfileId, sourceOrderId: order.orderId, sourceReferenceId: order.orderNumber, commissionRuleId: rule.id, ruleEffectiveFrom: rule.effectiveFrom, commissionType: rule.commissionType, ...(level ? { level } : {}), calculationBasis: rule.calculationBasis, rewardType: rule.rewardType, ...(rule.rateBasisPoints ? { rateBasisPoints: rule.rateBasisPoints } : {}), ...(rule.fixedAmountMinor != null ? { fixedAmountMinor: rule.fixedAmountMinor } : {}), currency: order.currency, baseAmountMinor, amountMinor };
}

/** Pure planner: rules and hierarchy come from persisted data; no UI values are accepted. */
export function planCommissions({ order, rules, uplines, eligibleAt }: { order: CommissionableOrder; rules: CommissionRuleSnapshot[]; uplines: UplineCandidate[]; eligibleAt: Date }) {
  if (commissionBase(order, "ORDER_SUBTOTAL") === 0n && commissionBase(order, "ORDER_TOTAL") === 0n && commissionBase(order, "PV") === 0n && commissionBase(order, "BV") === 0n) return [];
  const direct = uplines[0]?.activationStatus === "ACTIVE" ? uplines[0] : undefined; const plans: PlannedCommission[] = [];
  if (direct) { const directRule = selectRule(rules, "DIRECT", undefined, eligibleAt); if (directRule) { const plan = toPlan(order, direct, directRule); if (plan) plans.push(plan); } }
  for (let index = 0; index < uplines.length; index += 1) { const level = index + 1; const recipient = uplines[index]; if (recipient.activationStatus !== "ACTIVE") continue; const rule = selectRule(rules, "LEVEL", level, eligibleAt); if (!rule) continue; const plan = toPlan(order, recipient, rule, level); if (plan) plans.push(plan); }
  return plans;
}
