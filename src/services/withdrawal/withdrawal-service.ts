import "server-only";

import { type ClientSession, type Types, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { MemberPaymentDetails, MemberProfile, Notification, Wallet, Withdrawal } from "@/models";
import type { WithdrawalStatus } from "@/types/domain";
import { WalletService } from "@/services/wallet/wallet-service";
import { assertWithdrawalTransition } from "@/services/withdrawal/withdrawal-transitions";
import { notifyAdministrators } from "@/services/notifications/notification-service";
import { SystemSettingsService } from "@/services/settings/system-settings-service";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";

const DEFAULT_MINIMUM_MINOR = 10_000n;

export type WithdrawalResult = { id: string; created?: boolean; status: WithdrawalStatus };

function getSettingMinor(value: unknown, fallback?: bigint) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw errors.badRequest("Withdrawal amount settings are invalid.");
}

async function withdrawalLimits(session: ClientSession) {
  const configuration = await SystemSettingsService.read(session);
  const minimumMinor = getSettingMinor(configuration.settings.withdrawal.minimumMinor, DEFAULT_MINIMUM_MINOR)!;
  const maximumMinor = configuration.settings.withdrawal.maximumEnabled ? getSettingMinor(configuration.settings.withdrawal.maximumMinor) : undefined;
  if (maximumMinor !== undefined && maximumMinor < minimumMinor) throw errors.badRequest("Withdrawal maximum is lower than the minimum.");
  return { minimumMinor, maximumMinor, requirePaymentDetails: configuration.settings.withdrawal.requirePaymentDetails, currency: configuration.settings.currency };
}

function duplicateKey(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000; }

export class WithdrawalService {
  static async request(input: { memberProfileId: Types.ObjectId; amountMinor: bigint; idempotencyKey: string; currency?: string }): Promise<WithdrawalResult> {
    if (input.amountMinor <= 0n) throw errors.badRequest("Withdrawal amount must be greater than zero.");
    await connectToDatabase();
    const session = await startSession(); let result: WithdrawalResult | undefined;
    try {
      await session.withTransaction(async () => {
        const existing = await Withdrawal.findOne({ memberProfileId: input.memberProfileId, idempotencyKey: input.idempotencyKey }).session(session).lean();
        if (existing) { result = { id: String(existing._id), created: false, status: existing.status }; return; }
        const [profile, payment, limits] = await Promise.all([
          MemberProfile.findById(input.memberProfileId).select("userId activationStatus").session(session).lean(),
          MemberPaymentDetails.findOne({ memberProfileId: input.memberProfileId }).select("accountLast4 updatedAt").session(session).lean(),
          withdrawalLimits(session),
        ]);
        if (!profile || profile.activationStatus !== "ACTIVE") throw errors.forbidden("Only active members can request withdrawals.");
        if (limits.requirePaymentDetails && !payment) throw errors.badRequest("Add bank or payment details before requesting a withdrawal.");
        if (input.amountMinor < limits.minimumMinor) throw errors.badRequest(`The minimum withdrawal amount is ${limits.minimumMinor.toString()} minor units.`);
        if (limits.maximumMinor !== undefined && input.amountMinor > limits.maximumMinor) throw errors.badRequest(`The maximum withdrawal amount is ${limits.maximumMinor.toString()} minor units.`);
        const currency = (input.currency ?? limits.currency).toUpperCase();
        const wallet = await Wallet.findOne({ memberProfileId: input.memberProfileId, currency }).session(session).lean();
        if (!wallet) throw errors.notFound("The member wallet was not found.");
        const provisional = await Withdrawal.create([{ memberProfileId: input.memberProfileId, walletId: wallet._id, currency, amountMinor: input.amountMinor, status: "PENDING", idempotencyKey: input.idempotencyKey, destinationSnapshot: payment ? { accountLast4: payment.accountLast4, detailsUpdatedAt: payment.updatedAt.toISOString() } : { paymentDetailsRequired: false }, statusHistory: [{ status: "PENDING", changedAt: new Date() }] }], { session });
        await WalletService.postInTransaction({ memberProfileId: input.memberProfileId, currency, type: "WITHDRAWAL_RESERVATION", direction: "DEBIT", amountMinor: input.amountMinor, referenceType: "WITHDRAWAL", referenceId: String(provisional[0]._id), idempotencyKey: `withdrawal-reserve:${input.idempotencyKey}`, description: "Funds reserved for withdrawal request", metadata: { withdrawalId: String(provisional[0]._id) } }, session);
        await Notification.create([{ userId: profile.userId, type: "WITHDRAWAL", title: "Withdrawal requested", body: "Your withdrawal request is pending review.", actionUrl: "/member/withdrawals", metadata: { withdrawalId: String(provisional[0]._id), amountMinor: input.amountMinor.toString(), currency } }], { session });
        await notifyAdministrators({ type: "WITHDRAWAL", title: "Withdrawal requires review", body: "A member submitted a withdrawal request.", actionUrl: "/admin/withdrawals", metadata: { withdrawalId: String(provisional[0]._id) }, session });
        result = { id: String(provisional[0]._id), created: true, status: "PENDING" };
      });
      if (!result) throw new Error("Withdrawal request did not complete.");
      return result;
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      const existing = await Withdrawal.findOne({ memberProfileId: input.memberProfileId, idempotencyKey: input.idempotencyKey }).lean();
      if (!existing) throw error;
      return { id: String(existing._id), created: false, status: existing.status };
    } finally { await session.endSession(); }
  }

  static async transition(input: { withdrawalId: Types.ObjectId; targetStatus: WithdrawalStatus; actorUserId: Types.ObjectId; memberProfileId?: Types.ObjectId; note?: string; paymentReference?: string; memberInitiated?: boolean } & AuditRequestContext): Promise<WithdrawalResult> {
    await connectToDatabase(); const session = await startSession(); let result: WithdrawalResult | undefined;
    try {
      await session.withTransaction(async () => {
        const withdrawal = await Withdrawal.findById(input.withdrawalId).session(session);
        if (!withdrawal) throw errors.notFound("Withdrawal request was not found.");
        if (input.memberInitiated && (input.targetStatus !== "CANCELLED" || !input.memberProfileId || String(withdrawal.memberProfileId) !== String(input.memberProfileId))) throw errors.forbidden();
        try { assertWithdrawalTransition(withdrawal.status, input.targetStatus); } catch (error) { throw errors.conflict(error instanceof Error ? error.message : "Invalid withdrawal transition."); }
        if (input.targetStatus === "REJECTED" && !input.note?.trim()) throw errors.badRequest("A rejection reason is required.");
        if (input.targetStatus === "COMPLETED" && !input.paymentReference?.trim()) throw errors.badRequest("A payment reference is required when completing a withdrawal.");
        if (input.targetStatus === "REJECTED" || input.targetStatus === "CANCELLED") {
          await WalletService.postInTransaction({ memberProfileId: withdrawal.memberProfileId, currency: withdrawal.currency, type: "WITHDRAWAL_RELEASE", direction: "CREDIT", amountMinor: withdrawal.amountMinor, referenceType: "WITHDRAWAL", referenceId: String(withdrawal._id), idempotencyKey: `withdrawal-release:${String(withdrawal._id)}`, description: `Withdrawal ${input.targetStatus.toLowerCase()}; reserved funds released`, metadata: { withdrawalId: String(withdrawal._id), note: input.note } }, session);
        }
        if (input.targetStatus === "COMPLETED") {
          await WalletService.postInTransaction({ memberProfileId: withdrawal.memberProfileId, currency: withdrawal.currency, type: "WITHDRAWAL", direction: "DEBIT", amountMinor: withdrawal.amountMinor, referenceType: "WITHDRAWAL", referenceId: String(withdrawal._id), idempotencyKey: `withdrawal-settlement:${String(withdrawal._id)}`, description: "Withdrawal completed", metadata: { withdrawalId: String(withdrawal._id), paymentReference: input.paymentReference } }, session);
        }
        const previousStatus = withdrawal.status; const now = new Date();
        withdrawal.status = input.targetStatus;
        withdrawal.statusHistory.push({ status: input.targetStatus, changedAt: now, changedByUserId: input.actorUserId, ...(input.note?.trim() ? { note: input.note.trim() } : {}), ...(input.paymentReference?.trim() ? { paymentReference: input.paymentReference.trim() } : {}) });
        if (!input.memberInitiated) { withdrawal.reviewedByUserId = input.actorUserId; withdrawal.reviewedAt = now; }
        if (input.targetStatus === "COMPLETED") { withdrawal.completedAt = now; withdrawal.paymentReference = input.paymentReference!.trim(); }
        await withdrawal.save({ session });
        const member = await MemberProfile.findById(withdrawal.memberProfileId).select("userId").session(session).lean();
        if (member) await Notification.create([{ userId: member.userId, type: "WITHDRAWAL", title: `Withdrawal ${input.targetStatus.toLowerCase()}`, body: input.targetStatus === "COMPLETED" ? "Your withdrawal has been completed." : `Your withdrawal status is now ${input.targetStatus.toLowerCase()}.`, actionUrl: "/member/withdrawals", metadata: { withdrawalId: String(withdrawal._id), ...(input.paymentReference ? { paymentReference: input.paymentReference } : {}) } }], { session });
        if (!input.memberInitiated) await AuditService.record({ actorUserId: input.actorUserId, action: "withdrawal.status_changed", resourceType: "Withdrawal", resourceId: String(withdrawal._id), ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}), ...(input.userAgent ? { userAgent: input.userAgent } : {}), before: { status: previousStatus }, after: { status: input.targetStatus, ...(input.paymentReference ? { paymentReference: input.paymentReference } : {}) }, metadata: { note: input.note } }, session);
        result = { id: String(withdrawal._id), status: input.targetStatus };
      });
      if (!result) throw new Error("Withdrawal transition did not complete."); return result;
    } finally { await session.endSession(); }
  }
}
