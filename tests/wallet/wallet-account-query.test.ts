import assert from "node:assert/strict";
import test from "node:test";

import { parseWalletListFilters } from "@/services/wallet/wallet-query";

test("wallet account summary filters use exact minor units without float conversion", () => {
  const filters = parseWalletListFilters(new URLSearchParams("page=2&limit=50&q=MLM000001&minBalance=12.34&maxBalance=99.99"));

  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 50);
  assert.equal(filters.q, "MLM000001");
  assert.equal(filters.minBalanceMinor, 1234n);
  assert.equal(filters.maxBalanceMinor, 9999n);
});

test("wallet account summary filters reject unsafe pagination and invalid balance values", () => {
  assert.throws(() => parseWalletListFilters(new URLSearchParams("page=0")));
  assert.throws(() => parseWalletListFilters(new URLSearchParams("minBalance=-1")));
  assert.throws(() => parseWalletListFilters(new URLSearchParams("minBalance=1.001")));
  assert.throws(() => parseWalletListFilters(new URLSearchParams("minBalance=20&maxBalance=10")));
});
