import "server-only";

import { type ClientSession, Types, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { AuditLog, CommissionRule, CommissionTransaction, MemberProfile, Notification, Order, SponsorRelationship } from "@/models";
import { commissionIdempotencyKey, planCommissions, type CommissionRuleSnapshot, type PlannedCommission } from "@/services/commission/commission-calculator";
import { WalletService } from "@/services/wallet/wallet-service";
import { SystemSettingsService } from "@/services/settings/system-settings-service";

export type CommissionProcessResult = { orderId: string; processed: boolean; reason?: "NOT_ELIGIBLE" | "ALREADY_PROCESSED" | "IN_PROGRESS"; commissionsCreated: number; amountMinor: bigint };

function isEligibleOrder(order: { status: string; paidAt?: Date }) { return order.status === "PAID" && Boolean(order.paidAt); }
function ruleSnapshot(rule: { _id: Types.ObjectId; commissionType: CommissionRuleSnapshot["commissionType"]; level?: number; calculationBasis: CommissionRuleSnapshot["calculationBasis"]; rewardType: CommissionRuleSnapshot["rewardType"]; rateBasisPoints?: number; fixedAmountMinor?: bigint; active: boolean; effectiveFrom: Date; effectiveTo?: Date }): CommissionRuleSnapshot { return { id: String(rule._id), commissionType: rule.commissionType, ...(rule.level ? { level: rule.level } : {}), calculationBasis: rule.calculationBasis, rewardType: rule.rewardType, ...(rule.rateBasisPoints ? { rateBasisPoints: rule.rateBasisPoints } : {}), ...(rule.fixedAmountMinor != null ? { fixedAmountMinor: rule.fixedAmountMinor } : {}), active: rule.active, effectiveFrom: rule.effectiveFrom, ...(rule.effectiveTo ? { effectiveTo: rule.effectiveTo } : {}) }; }

async function creditCommission(plan: PlannedCommission, session: ClientSession) {
  const commissionId = new Types.ObjectId();
  const posting = await WalletService.postInTransaction({
    memberProfileId: new Types.ObjectId(plan.recipientMemberProfileId), currency: plan.currency,
    type: plan.commissionType === "DIRECT" ? "DIRECT_COMMISSION" : "LEVEL_COMMISSION", direction: "CREDIT", amountMinor: plan.amountMinor,
    referenceType: "COMMISSION", referenceId: String(commissionId), idempotencyKey: commissionIdempotencyKey(plan),
    description: `${plan.commissionType === "DIRECT" ? "Direct referral" : `Level ${plan.level}`} commission for ${plan.sourceReferenceId}`,
    metadata: { sourceOrderId: plan.sourceOrderId, sourceMemberProfileId: plan.sourceMemberProfileId, calculationBasis: plan.calculationBasis, rateBasisPoints: plan.rateBasisPoints, fixedAmountMinor: plan.fixedAmountMinor },
  }, session);
  if (!posting.created) return;
  await CommissionTransaction.create([{ _id: commissionId, recipientMemberProfileId: new Types.ObjectId(plan.recipientMemberProfileId), sourceMemberProfileId: new Types.ObjectId(plan.sourceMemberProfileId), sourceReferenceType: "ORDER", sourceReferenceId: plan.sourceReferenceId, sourceOrderId: new Types.ObjectId(plan.sourceOrderId), commissionRuleId: new Types.ObjectId(plan.commissionRuleId), ruleEffectiveFrom: plan.ruleEffectiveFrom, commissionType: plan.commissionType, ...(plan.level ? { level: plan.level } : {}), calculationBasis: plan.calculationBasis, rewardType: plan.rewardType, ...(plan.rateBasisPoints ? { rateBasisPoints: plan.rateBasisPoints } : {}), ...(plan.fixedAmountMinor != null ? { fixedAmountMinor: plan.fixedAmountMinor } : {}), currency: plan.currency, baseAmountMinor: plan.baseAmountMinor, amountMinor: plan.amountMinor, status: "APPROVED", walletTransactionId: new Types.ObjectId(posting.transaction.id) }], { session });
  const member = await MemberProfile.findById(plan.recipientMemberProfileId).select("userId").session(session).lean();
  if (member) await Notification.create([{ userId: member.userId, type: "COMMISSION", title: "Commission credited", body: `${plan.commissionType === "DIRECT" ? "Direct referral" : `Level ${plan.level}`} commission has been credited to your wallet.`, actionUrl: "/member/wallet", metadata: { commissionId: String(commissionId), orderId: plan.sourceOrderId, amountMinor: plan.amountMinor.toString(), currency: plan.currency } }], { session });
}

export class CommissionService {
  static async processEligibleOrder(orderId: string): Promise<CommissionProcessResult> {
    if (!Types.ObjectId.isValid(orderId)) throw errors.badRequest("Invalid order identifier.");
    await connectToDatabase(); const session = await startSession(); let result: CommissionProcessResult = { orderId, processed: false, commissionsCreated: 0, amountMinor: 0n };
    try { await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order || !isEligibleOrder(order)) { result = { ...result, reason: "NOT_ELIGIBLE" }; return; }
      if (order.commissionStatus !== "PENDING") { result = { ...result, reason: order.commissionStatus === "PROCESSING" ? "IN_PROGRESS" : "ALREADY_PROCESSED" }; return; }
      const claimed = await Order.findOneAndUpdate({ _id: order._id, commissionStatus: "PENDING" }, { $set: { commissionStatus: "PROCESSING" } }, { new: true, session });
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
      for (const plan of plans) await creditCommission(plan, session);
      await Order.updateOne({ _id: order._id }, { $set: { commissionStatus: "COMPLETED" } }, { session });
      await AuditLog.create([{ action: "commission.processed", resourceType: "Order", resourceId: String(order._id), metadata: { orderNumber: order.orderNumber, commissionsCreated: plans.length, amountMinor: plans.reduce((sum, plan) => sum + plan.amountMinor, 0n).toString() } }], { session });
      result = { orderId, processed: true, commissionsCreated: plans.length, amountMinor: plans.reduce((sum, plan) => sum + plan.amountMinor, 0n) };
    }); } finally { await session.endSession(); }
    return result;
  }
}
