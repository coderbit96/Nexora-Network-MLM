import assert from "node:assert/strict";
import test from "node:test";

import { Withdrawal } from "@/models";
import { calculateWalletBalances, type WalletBalances } from "@/services/wallet/wallet-math";
import { canTransitionWithdrawal, WITHDRAWAL_TRANSITIONS } from "@/services/withdrawal/withdrawal-transitions";

const wallet = (availableMinor: bigint, heldMinor = 0n): WalletBalances => ({ availableMinor, heldMinor, lifetimeCreditMinor: availableMinor, lifetimeDebitMinor: 0n, lifetimeEarningsMinor: availableMinor, lifetimeWithdrawalsMinor: 0n });

test("withdrawal transition map allows only the explicit workflow", () => {
  assert.deepEqual(WITHDRAWAL_TRANSITIONS.PENDING, ["APPROVED", "REJECTED", "CANCELLED"]);
  assert.equal(canTransitionWithdrawal("PENDING", "APPROVED"), true);
  assert.equal(canTransitionWithdrawal("APPROVED", "PROCESSING"), true);
  assert.equal(canTransitionWithdrawal("PROCESSING", "COMPLETED"), true);
  assert.equal(canTransitionWithdrawal("PENDING", "COMPLETED"), false);
  assert.equal(canTransitionWithdrawal("COMPLETED", "REJECTED"), false);
});

test("request reserves funds, rejection releases them, and completion settles held funds", () => {
  const reserved = calculateWalletBalances(wallet(10_000n), { direction: "DEBIT", type: "WITHDRAWAL_RESERVATION", amountMinor: 2_500n });
  assert.equal(reserved.availableMinor, 7_500n); assert.equal(reserved.heldMinor, 2_500n); assert.equal(reserved.lifetimeDebitMinor, 0n);
  const released = calculateWalletBalances(reserved, { direction: "CREDIT", type: "WITHDRAWAL_RELEASE", amountMinor: 2_500n });
  assert.equal(released.availableMinor, 10_000n); assert.equal(released.heldMinor, 0n);
  const completed = calculateWalletBalances(reserved, { direction: "DEBIT", type: "WITHDRAWAL", amountMinor: 2_500n });
  assert.equal(completed.availableMinor, 7_500n); assert.equal(completed.heldMinor, 0n); assert.equal(completed.lifetimeDebitMinor, 2_500n); assert.equal(completed.lifetimeWithdrawalsMinor, 2_500n);
});

test("concurrent withdrawal reservation attempts cannot reserve the same available funds twice", async () => {
  let state = wallet(1_000n); let tail = Promise.resolve(); const outcomes: string[] = [];
  const reserve = () => { const operation = tail.then(() => { try { state = calculateWalletBalances(state, { direction: "DEBIT", type: "WITHDRAWAL_RESERVATION", amountMinor: 700n }); outcomes.push("reserved"); } catch { outcomes.push("rejected"); } }); tail = operation.catch(() => undefined); return operation; };
  await Promise.all([reserve(), reserve()]);
  assert.deepEqual(outcomes.sort(), ["rejected", "reserved"]);
  assert.equal(state.availableMinor, 300n); assert.equal(state.heldMinor, 700n);
});

test("duplicate withdrawal idempotency is backed by a unique member request key", () => {
  // The Withdrawal schema's compound unique index is asserted here without requiring a running database.
  // The service also checks this key in its transaction and handles a concurrent duplicate-key result.
  const indexes = Withdrawal.schema.indexes() as Array<[Record<string, 1 | -1>, { unique?: boolean }]>;
  assert.equal(indexes.some(([keys, options]) => "memberProfileId" in keys && "idempotencyKey" in keys && options.unique === true), true);
});
