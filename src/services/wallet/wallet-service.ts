import "server-only";

import { type ClientSession, type Types, startSession } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";
import { errors } from "@/lib/errors/app-error";
import { Wallet, WalletTransaction } from "@/models";
import type { LedgerDirection, WalletTransactionType } from "@/types/domain";
import { calculateWalletBalances, type WalletBalances } from "@/services/wallet/wallet-math";
import { AuditService, type AuditRequestContext } from "@/services/audit/audit-service";

export type WalletPostingInput = {
  memberProfileId: Types.ObjectId;
  currency: string;
  type: WalletTransactionType;
  direction: LedgerDirection;
  amountMinor: bigint;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export type WalletPostingResult = {
  created: boolean;
  wallet: WalletBalances & { id: string; memberProfileId: string; currency: string };
  transaction: { id: string; resultingAvailableMinor: bigint; resultingHeldMinor: bigint };
};

function toBalances(wallet: { availableMinor: bigint; heldMinor: bigint; lifetimeCreditMinor: bigint; lifetimeDebitMinor: bigint; lifetimeEarningsMinor: bigint; lifetimeWithdrawalsMinor: bigint }): WalletBalances {
  return {
    availableMinor: wallet.availableMinor,
    heldMinor: wallet.heldMinor,
    lifetimeCreditMinor: wallet.lifetimeCreditMinor,
    lifetimeDebitMinor: wallet.lifetimeDebitMinor,
    lifetimeEarningsMinor: wallet.lifetimeEarningsMinor,
    lifetimeWithdrawalsMinor: wallet.lifetimeWithdrawalsMinor,
  };
}

function normalizeCurrency(currency: string) {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw errors.badRequest("A valid three-letter currency is required.");
  return normalized;
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}

export class WalletService {
  /** Posts an immutable ledger entry and its wallet-summary mutation in the provided database transaction. */
  static async postInTransaction(input: WalletPostingInput, session: ClientSession): Promise<WalletPostingResult> {
    if (input.amountMinor <= 0n) throw errors.badRequest("Wallet transaction amount must be greater than zero.");
    const currency = normalizeCurrency(input.currency);

    const existing = await WalletTransaction.findOne({ idempotencyKey: input.idempotencyKey }).session(session).lean();
    if (existing) {
      const existingWallet = await Wallet.findById(existing.walletId).session(session).lean();
      if (!existingWallet) throw new Error("Wallet transaction references a missing wallet.");
      return {
        created: false,
        wallet: { id: String(existingWallet._id), memberProfileId: String(existingWallet.memberProfileId), currency: existingWallet.currency, ...toBalances(existingWallet) },
        transaction: { id: String(existing._id), resultingAvailableMinor: existing.resultingAvailableMinor, resultingHeldMinor: existing.resultingHeldMinor },
      };
    }

    const wallet = await Wallet.findOne({ memberProfileId: input.memberProfileId, currency }).session(session);
    if (!wallet) throw errors.notFound("The member wallet was not found.");

    let next: WalletBalances;
    try { next = calculateWalletBalances(toBalances(wallet), input); }
    catch (error) {
      if (error instanceof Error && error.message === "Insufficient available wallet balance.") throw errors.conflict(error.message);
      throw errors.badRequest(error instanceof Error ? error.message : "Invalid wallet posting.");
    }

    const transaction = await WalletTransaction.create([{
      walletId: wallet._id,
      memberProfileId: wallet.memberProfileId,
      currency,
      type: input.type,
      direction: input.direction,
      amountMinor: input.amountMinor,
      resultingAvailableMinor: next.availableMinor,
      resultingHeldMinor: next.heldMinor,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }], { session });

    await Wallet.updateOne({ _id: wallet._id }, { $set: next }, { session, runValidators: true });
    return {
      created: true,
      wallet: { id: String(wallet._id), memberProfileId: String(wallet.memberProfileId), currency, ...next },
      transaction: { id: String(transaction[0]._id), resultingAvailableMinor: next.availableMinor, resultingHeldMinor: next.heldMinor },
    };
  }

  /** Uses a MongoDB transaction, which retries write conflicts so concurrent balance changes remain serializable. */
  static async post(input: WalletPostingInput): Promise<WalletPostingResult> {
    await connectToDatabase();
    const session = await startSession();
    let result: WalletPostingResult | undefined;
    try {
      await session.withTransaction(async () => { result = await WalletService.postInTransaction(input, session); });
      if (!result) throw new Error("Wallet posting did not complete.");
      return result;
    } catch (error) {
      // A competing request may have committed the same idempotency key first.
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await WalletTransaction.findOne({ idempotencyKey: input.idempotencyKey }).lean();
      const wallet = existing ? await Wallet.findById(existing.walletId).lean() : null;
      if (!existing || !wallet) throw error;
      return { created: false, wallet: { id: String(wallet._id), memberProfileId: String(wallet.memberProfileId), currency: wallet.currency, ...toBalances(wallet) }, transaction: { id: String(existing._id), resultingAvailableMinor: existing.resultingAvailableMinor, resultingHeldMinor: existing.resultingHeldMinor } };
    } finally { await session.endSession(); }
  }

  static async adjustByAdmin(input: Omit<WalletPostingInput, "type" | "referenceType" | "referenceId" | "description"> & { actorUserId: Types.ObjectId; reason: string } & AuditRequestContext): Promise<WalletPostingResult> {
    const reason = input.reason.trim();
    if (reason.length < 10) throw errors.badRequest("A reason of at least 10 characters is required for an adjustment.");
    if (input.direction !== "CREDIT" && input.direction !== "DEBIT") throw errors.badRequest("Invalid adjustment direction.");
    await connectToDatabase();
    const session = await startSession();
    let result: WalletPostingResult | undefined;
    try {
      await session.withTransaction(async () => {
        result = await WalletService.postInTransaction({
          ...input,
          type: input.direction === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
          referenceType: "ADMIN_ADJUSTMENT",
          referenceId: input.idempotencyKey,
          description: `Administrator adjustment: ${reason}`,
          metadata: { ...(input.metadata ?? {}), reason, actorUserId: String(input.actorUserId) },
        }, session);
        if (result.created) await AuditService.record({
          actorUserId: input.actorUserId,
          action: "wallet.adjusted",
          resourceType: "Wallet",
          resourceId: result.wallet.id,
          after: { direction: input.direction, type: input.direction === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT", amountMinor: input.amountMinor.toString(), resultingAvailableMinor: result.transaction.resultingAvailableMinor.toString() },
          metadata: { memberProfileId: String(input.memberProfileId), reason, idempotencyKey: input.idempotencyKey },
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}), ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        }, session);
      });
      if (!result) throw new Error("Wallet adjustment did not complete.");
      return result;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await WalletTransaction.findOne({ idempotencyKey: input.idempotencyKey }).lean();
      const wallet = existing ? await Wallet.findById(existing.walletId).lean() : null;
      if (!existing || !wallet) throw error;
      return { created: false, wallet: { id: String(wallet._id), memberProfileId: String(wallet.memberProfileId), currency: wallet.currency, ...toBalances(wallet) }, transaction: { id: String(existing._id), resultingAvailableMinor: existing.resultingAvailableMinor, resultingHeldMinor: existing.resultingHeldMinor } };
    } finally { await session.endSession(); }
  }
}
