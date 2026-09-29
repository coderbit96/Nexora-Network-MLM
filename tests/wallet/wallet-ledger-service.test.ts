import assert from "node:assert/strict";
import test from "node:test";

import { WalletTransaction } from "@/models";
import { parseWalletLedgerFilters, walletLedgerCsvCell } from "@/services/wallet/wallet-ledger-service";

test("wallet ledger filters preserve exact minor-unit values and supported filters", () => {
  const filters = parseWalletLedgerFilters(new URLSearchParams({
    page: "2", limit: "25", member: "MLM000001", direction: "CREDIT", type: "DIRECT_COMMISSION", reference: "ORD-10",
    minAmount: "12.34", maxAmount: "99.99", from: "2026-01-01", to: "2026-01-31",
  }));

  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 25);
  assert.equal(filters.member, "MLM000001");
  assert.equal(filters.direction, "CREDIT");
  assert.equal(filters.type, "DIRECT_COMMISSION");
  assert.equal(filters.reference, "ORD-10");
  assert.equal(filters.minAmountMinor, 1234n);
  assert.equal(filters.maxAmountMinor, 9999n);
  assert.equal(filters.from?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(filters.to?.toISOString(), "2026-01-31T23:59:59.999Z");
});

test("wallet ledger filters reject injection-shaped values, unsafe pagination, and invalid financial ranges", () => {
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("page=0")));
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("direction=$ne")));
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("type=ADMIN_SET_BALANCE")));
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("minAmount=-1")));
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("minAmount=1.001")));
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("minAmount=20&maxAmount=10")));
  assert.throws(() => parseWalletLedgerFilters(new URLSearchParams("from=2026-02-01&to=2026-01-01")));
});

test("wallet ledger CSV cells neutralize spreadsheet formulas", () => {
  assert.equal(walletLedgerCsvCell("=SUM(A1:A2)"), "\"'=SUM(A1:A2)\"");
  assert.equal(walletLedgerCsvCell('say "hello"'), '"say ""hello"""');
});

test("wallet ledger has indexes for immutable history filters", () => {
  const indexes = (WalletTransaction.schema.indexes() as Array<[Record<string, 1 | -1>, Record<string, unknown>]>).map(([keys]) => keys);
  assert.equal(indexes.some((keys) => "memberProfileId" in keys && "createdAt" in keys), true);
  assert.equal(indexes.some((keys) => "type" in keys && "createdAt" in keys), true);
  assert.equal(indexes.some((keys) => "direction" in keys && "createdAt" in keys), true);
  assert.equal(indexes.some((keys) => "referenceType" in keys && "referenceId" in keys && "createdAt" in keys), true);
});
