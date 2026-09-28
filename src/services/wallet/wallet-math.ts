import type { LedgerDirection, WalletTransactionType } from "@/types/domain";

export type WalletBalances = {
  availableMinor: bigint;
  heldMinor: bigint;
  lifetimeCreditMinor: bigint;
  lifetimeDebitMinor: bigint;
  lifetimeEarningsMinor: bigint;
  lifetimeWithdrawalsMinor: bigint;
};

export type WalletPosting = {
  direction: LedgerDirection;
  type: WalletTransactionType;
  amountMinor: bigint;
};

const earningTypes = new Set<WalletTransactionType>(["DIRECT_COMMISSION", "LEVEL_COMMISSION"]);

/**
 * Applies one ledger posting to a wallet summary using integer minor units only.
 * Callers must persist the returned summary and immutable ledger entry atomically.
 */
export function calculateWalletBalances(current: WalletBalances, posting: WalletPosting): WalletBalances {
  if (posting.amountMinor <= 0n) throw new Error("Wallet transaction amount must be greater than zero.");
  if (posting.type === "WITHDRAWAL_RESERVATION") {
    if (posting.direction !== "DEBIT") throw new Error("Withdrawal reservations must debit available balance.");
    if (current.availableMinor < posting.amountMinor) throw new Error("Insufficient available wallet balance.");
    return { ...current, availableMinor: current.availableMinor - posting.amountMinor, heldMinor: current.heldMinor + posting.amountMinor };
  }
  if (posting.type === "WITHDRAWAL_RELEASE") {
    if (posting.direction !== "CREDIT") throw new Error("Withdrawal releases must credit available balance.");
    if (current.heldMinor < posting.amountMinor) throw new Error("Insufficient reserved wallet balance.");
    return { ...current, availableMinor: current.availableMinor + posting.amountMinor, heldMinor: current.heldMinor - posting.amountMinor };
  }
  if (posting.type === "WITHDRAWAL") {
    if (posting.direction !== "DEBIT") throw new Error("Withdrawal settlement must debit reserved balance.");
    if (current.heldMinor < posting.amountMinor) throw new Error("Insufficient reserved wallet balance.");
    return { ...current, heldMinor: current.heldMinor - posting.amountMinor, lifetimeDebitMinor: current.lifetimeDebitMinor + posting.amountMinor, lifetimeWithdrawalsMinor: current.lifetimeWithdrawalsMinor + posting.amountMinor };
  }
  if (posting.direction === "DEBIT" && current.availableMinor < posting.amountMinor) {
    throw new Error("Insufficient available wallet balance.");
  }

  const isCredit = posting.direction === "CREDIT";
  return {
    availableMinor: isCredit ? current.availableMinor + posting.amountMinor : current.availableMinor - posting.amountMinor,
    heldMinor: current.heldMinor,
    lifetimeCreditMinor: isCredit ? current.lifetimeCreditMinor + posting.amountMinor : current.lifetimeCreditMinor,
    lifetimeDebitMinor: isCredit ? current.lifetimeDebitMinor : current.lifetimeDebitMinor + posting.amountMinor,
    lifetimeEarningsMinor: isCredit && earningTypes.has(posting.type) ? current.lifetimeEarningsMinor + posting.amountMinor : current.lifetimeEarningsMinor,
    lifetimeWithdrawalsMinor: current.lifetimeWithdrawalsMinor,
  };
}
