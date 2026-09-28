import assert from "node:assert/strict";
import test from "node:test";

import { WalletTransaction } from "@/models";
import { calculateWalletBalances, type WalletBalances } from "@/services/wallet/wallet-math";

const emptyWallet = (): WalletBalances => ({ availableMinor: 0n, heldMinor: 0n, lifetimeCreditMinor: 0n, lifetimeDebitMinor: 0n, lifetimeEarningsMinor: 0n, lifetimeWithdrawalsMinor: 0n });

test("wallet posting uses exact integer minor units and records commission earnings", () => {
  const result = calculateWalletBalances(emptyWallet(), { direction: "CREDIT", type: "DIRECT_COMMISSION", amountMinor: 10_005n });
  assert.deepEqual(result, { availableMinor: 10_005n, heldMinor: 0n, lifetimeCreditMinor: 10_005n, lifetimeDebitMinor: 0n, lifetimeEarningsMinor: 10_005n, lifetimeWithdrawalsMinor: 0n });
});

test("withdrawal settlement cannot spend balance twice and increments lifetime withdrawals", () => {
  const funded = calculateWalletBalances(emptyWallet(), { direction: "CREDIT", type: "ADMIN_CREDIT", amountMinor: 1_000n });
  const reserved = calculateWalletBalances(funded, { direction: "DEBIT", type: "WITHDRAWAL_RESERVATION", amountMinor: 600n });
  const withdrawn = calculateWalletBalances(reserved, { direction: "DEBIT", type: "WITHDRAWAL", amountMinor: 600n });
  assert.equal(withdrawn.availableMinor, 400n);
  assert.equal(withdrawn.lifetimeWithdrawalsMinor, 600n);
  assert.throws(() => calculateWalletBalances(withdrawn, { direction: "DEBIT", type: "WITHDRAWAL", amountMinor: 1n }), /Insufficient reserved/);
});

test("ledger schema requires positive amounts and keeps financial history immutable", async () => {
  const invalid = new WalletTransaction({ walletId: "507f1f77bcf86cd799439011", memberProfileId: "507f1f77bcf86cd799439012", currency: "INR", type: "OTHER", direction: "CREDIT", amountMinor: 0n, resultingAvailableMinor: 0n, resultingHeldMinor: 0n, referenceType: "TEST", referenceId: "test", idempotencyKey: "wallet-test", description: "test" });
  assert.ok(invalid.validateSync()?.errors.amountMinor);
  await assert.rejects(WalletTransaction.deleteMany({}).exec(), /cannot be deleted/i);
});

test("concurrent credit attempts serialize to the same exact summary", async () => {
  let state = emptyWallet(); let tail = Promise.resolve();
  const post = (amountMinor: bigint) => {
    const operation = tail.then(() => { state = calculateWalletBalances(state, { direction: "CREDIT", type: "LEVEL_COMMISSION", amountMinor }); });
    tail = operation.catch(() => undefined);
    return operation;
  };
  await Promise.all(Array.from({ length: 50 }, () => post(3n)));
  assert.equal(state.availableMinor, 150n);
  assert.equal(state.lifetimeEarningsMinor, 150n);
  assert.equal(state.lifetimeCreditMinor, 150n);
});
