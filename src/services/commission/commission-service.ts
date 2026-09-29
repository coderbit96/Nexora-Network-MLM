import "server-only";

import { type ClientSession, Types, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { AuditLog, CommissionRule, CommissionTransaction, MemberProfile, Notification, Order, SponsorRelationship } from "@/models";
import { commissionIdempotencyKey, planCommissions, type CommissionRuleSnapshot, type PlannedCommission } from "@/services/commission/commission-calculator";
import { WalletService } from "@/services/wallet/wallet-service";
import { SystemSettingsService } from "@/services/settings/system-settings-service";

export type CommissionProcessResult = { orderId: string; processed: boolean; reason?: "NOT_ELIGIBLE" | "ALREADY_PROCESSED" | "IN_PROGRESS"; commissionsCreated: number; amountMinor: bigint };

/** A fulfilled order remains eligible after its payment was verified. Refunded/cancelled orders never do. */
function isEligibleOrder(order: { status: string; paymentStatus: string; paidAt?: Date }) {
  return order.paymentStatus === "SUCCESS" && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status) && Boolean(order.paidAt);
}
function ruleSnapshot(rule: { _id: Types.ObjectId; commissionType: CommissionRuleSnapshot["commissionType"]; level?: number; calculationBasis: CommissionRuleSnapshot["calculationBasis"]; rewardType: CommissionRuleSnapshot["rewardType"]; rateBasisPoints?: number; fixedAmountMinor?: bigint; active: boolean; effectiveFrom: Date; effectiveTo?: Date }): CommissionRuleSnapshot { return { id: String(rule._id), commissionType: rule.commissionType, ...(rule.level ? { level: rule.level } : {}), calculationBasis: rule.calculationBasis, rewardType: rule.rewardType, ...(rule.rateBasisPoints ? { rateBasisPoints: rule.rateBasisPoints } : {}), ...(rule.fixedAmountMinor != null ? { fixedAmountMinor: rule.fixedAmountMinor } : {}), active: rule.active, effectiveFrom: rule.effectiveFrom, ...(rule.effectiveTo ? { effectiveTo: rule.effectiveTo } : {}) }; }

async function creditCommission(plan: PlannedCommission, session: ClientSession): Promise<boolean> {
  const commissionId = new Types.ObjectId();
  // This source-order/beneficiary/rule tuple is the entitlement identity. It must not
  // depend on a newly-generated ObjectId, otherwise a retry cannot prove it is the
  // same financial operation before it attempts a new wallet posting.
  const idempotencyKey = commissionIdempotencyKey(plan);
  const posting = await WalletService.postInTransaction({
    memberProfileId: new Types.ObjectId(plan.recipientMemberProfileId), currency: plan.currency,
    type: plan.commissionType === "DIRECT" ? "DIRECT_COMMISSION" : "LEVEL_COMMISSION", direction: "CREDIT", amountMinor: plan.amountMinor,
    referenceType: "COMMISSION", referenceId: idempotencyKey, idempotencyKey,
    description: `${plan.commissionType === "DIRECT" ? "Direct referral" : `Level ${plan.level}`} commission for ${plan.sourceReferenceId}`,
    metadata: { sourceOrderId: plan.sourceOrderId, sourceMemberProfileId: plan.sourceMemberProfileId, calculationBasis: plan.calculationBasis, rateBasisPoints: plan.rateBasisPoints, fixedAmountMinor: plan.fixedAmountMinor },
  }, session);
  if (!posting.created) {
    const existing = await CommissionTransaction.findOne({ sourceReferenceType: "ORDER", sourceReferenceId: plan.sourceReferenceId, recipientMemberProfileId: plan.recipientMemberProfileId, commissionRuleId: plan.commissionRuleId }).session(session).lean();
    // A durable wallet credit without its immutable commission entitlement is inconsistent.
    // Do not silently mark the source order complete; abort so an operator can investigate.
    if (!existing || String(existing.walletTransactionId) !== posting.transaction.id) throw errors.conflict("The existing commission ledger entry is inconsistent and requires review.");
    return false;
  }
  await CommissionTransaction.create([{ _id: commissionId, recipientMemberProfileId: new Types.ObjectId(plan.recipientMemberProfileId), sourceMemberProfileId: new Types.ObjectId(plan.sourceMemberProfileId), sourceReferenceType: "ORDER", sourceReferenceId: plan.sourceReferenceId, sourceOrderId: new Types.ObjectId(plan.sourceOrderId), commissionRuleId: new Types.ObjectId(plan.commissionRuleId), ruleEffectiveFrom: plan.ruleEffectiveFrom, commissionType: plan.commissionType, ...(plan.level ? { level: plan.level } : {}), calculationBasis: plan.calculationBasis, rewardType: plan.rewardType, ...(plan.rateBasisPoints ? { rateBasisPoints: plan.rateBasisPoints } : {}), ...(plan.fixedAmountMinor != null ? { fixedAmountMinor: plan.fixedAmountMinor } : {}), currency: plan.currency, baseAmountMinor: plan.baseAmountMinor, amountMinor: plan.amountMinor, status: "APPROVED", walletTransactionId: new Types.ObjectId(posting.transaction.id) }], { session });
  const member = await MemberProfile.findById(plan.recipientMemberProfileId).select("userId").session(session).lean();
  if (member) await Notification.create([{ userId: member.userId, type: "COMMISSION", title: "Commission credited", body: `${plan.commissionType === "DIRECT" ? "Direct referral" : `Level ${plan.level}`} commission has been credited to your wallet.`, actionUrl: "/member/wallet", metadata: { commissionId: String(commissionId), orderId: plan.sourceOrderId, amountMinor: plan.amountMinor.toString(), currency: plan.currency } }], { session });
  return true;
}

export class CommissionService {
  static async processEligibleOrder(orderId: string): Promise<CommissionProcessResult> {
    if (!Types.ObjectId.isValid(orderId)) throw errors.badRequest("Invalid order identifier.");
    await connectToDatabase(); const session = await startSession(); let result: CommissionProcessResult = { orderId, processed: false, commissionsCreated: 0, amountMinor: 0n };
    try { await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order || !isEligibleOrder(order)) { result = { ...result, reason: "NOT_ELIGIBLE" }; return; }
      if (order.commissionStatus !== "PENDING") { result = { ...result, reason: order.commissionStatus === "PROCESSING" ? "IN_PROGRESS" : "ALREADY_PROCESSED" }; return; }
      const claimed = await Order.findOneAndUpdate({ _id: order._id, commissionStatus: "PENDING" }, { $set: { commissionStatus: "PROCESSING" } }, { returnDocument: "after", session });
      if (!claimed) { result = { ...result, reason: "IN_PROGRESS" }; return; }
      const configuration = await SystemSettingsService.read(session);
      const minimumEligibleOrderMinor = BigInt(configuration.settings.commission.minimumEligibleOrderMinor);
      if (order.subtotalMinor < minimumEligibleOrderMinor) {
        await Order.updateOne({ _id: order._id }, { $set: { commissionStatus: "COMPLETED" } }, { session });
        await AuditLog.create([{ action: "commission.skipped_below_minimum", resourceType: "Order", resourceId: String(order._id), metadata: { orderNumber: order.orderNumber, subtotalMinor: order.subtotalMinor.toString(), minimumEligibleOrderMinor: minimumEligibleOrderMinor.toString() } }], { session });
        result = { orderId, processed: true, commissionsCreated: 0, amountMinor: 0n };
        return;
      }
      const [relationship, rules] = await Promise.all([SponsorRelationship.findOne({ memberProfileId: order.memberProfileId }).session(session).lean(), CommissionRule.find({ active: true, effectiveFrom: { $lte: order.paidAt }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: order.paidAt } }] }).session(session).lean()]);
      const uplineIds = relationship?.uplineMemberProfileIds ?? [];
      const uplineProfiles = uplineIds.length ? await MemberProfile.find({ _id: { $in: uplineIds } }).select("activationStatus").session(session).lean() : [];
      const statusById = new Map(uplineProfiles.map((profile) => [String(profile._id), profile.activationStatus]));
      const plans = planCommissions({ order: { sourceMemberProfileId: String(order.memberProfileId), orderId: String(order._id), orderNumber: order.orderNumber, currency: order.currency, subtotalMinor: order.subtotalMinor, totalMinor: order.totalMinor, items: order.items.map((item) => ({ pv: item.pv, bv: item.bv, quantity: item.quantity, lineTotalMinor: item.lineTotalMinor, commissionEligible: item.commissionEligible === true })) }, rules: rules.map(ruleSnapshot), uplines: uplineIds.map((id) => ({ memberProfileId: String(id), activationStatus: statusById.get(String(id)) ?? "INACTIVE" })), eligibleAt: order.paidAt! });
      let commissionsCreated = 0; let amountMinor = 0n;
      for (const plan of plans) {
        if (await creditCommission(plan, session)) {
          commissionsCreated += 1;
          amountMinor += plan.amountMinor;
        }
      }
      await Order.updateOne({ _id: order._id }, { $set: { commissionStatus: "COMPLETED" } }, { session });
      await AuditLog.create([{ action: "commission.processed", resourceType: "Order", resourceId: String(order._id), metadata: { orderNumber: order.orderNumber, commissionsCreated, amountMinor: amountMinor.toString() } }], { session });
      result = { orderId, processed: true, commissionsCreated, amountMinor };
    }); } finally { await session.endSession(); }
    return result;
  }
}
