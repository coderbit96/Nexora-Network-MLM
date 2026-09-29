import assert from "node:assert/strict";
import test from "node:test";

import { commissionRuleInputSchema } from "@/lib/validation/commission";
import { parseCommissionTransactionFilters } from "@/services/commission/commission-management-service";

const validDirectRule = {
  name: "Direct eligible-order commission",
  commissionType: "DIRECT",
  calculationBasis: "ORDER_SUBTOTAL",
  rewardType: "PERCENTAGE",
  percentage: "5.25",
  active: true,
  effectiveFrom: "2026-10-01",
};

test("commission rule input converts a valid percentage into integer basis points", () => {
  const parsed = commissionRuleInputSchema.parse(validDirectRule);

  assert.equal(parsed.percentage, 525);
  assert.equal(parsed.level, undefined);
});

test("commission rule input only accepts the engine's supported calculation bases", () => {
  const invalid = commissionRuleInputSchema.safeParse({ ...validDirectRule, calculationBasis: "NET_PROFIT" });

  assert.equal(invalid.success, false);
});

test("commission rule input rejects level information on direct rules and missing level rules", () => {
  assert.equal(commissionRuleInputSchema.safeParse({ ...validDirectRule, level: 1 }).success, false);
  assert.equal(commissionRuleInputSchema.safeParse({ ...validDirectRule, commissionType: "LEVEL" }).success, false);
});

test("commission rule input rejects invalid rates and invalid effective windows", () => {
  assert.equal(commissionRuleInputSchema.safeParse({ ...validDirectRule, percentage: "100.01" }).success, false);
  assert.equal(commissionRuleInputSchema.safeParse({ ...validDirectRule, effectiveTo: "2026-10-01" }).success, false);
  assert.equal(commissionRuleInputSchema.safeParse({ ...validDirectRule, extra: "never accepted" }).success, false);
});

test("commission transaction filters validate bounded pagination and supported values", () => {
  const filters = parseCommissionTransactionFilters(new URLSearchParams("page=2&limit=50&type=LEVEL&level=3&status=APPROVED&from=2026-10-01&to=2026-10-31&reference=order-123"));

  assert.equal(filters.page, 2);
  assert.equal(filters.limit, 50);
  assert.equal(filters.type, "LEVEL");
  assert.equal(filters.level, 3);
  assert.equal(filters.status, "APPROVED");
  assert.equal(filters.reference, "order-123");
});

test("commission transaction filters ignore query-operator shaped keys and reject invalid ranges", () => {
  const ignoredOperator = parseCommissionTransactionFilters(new URLSearchParams("type[$ne]=DIRECT"));
  assert.equal(ignoredOperator.type, undefined);
  assert.throws(() => parseCommissionTransactionFilters(new URLSearchParams("type=BINARY")));
  assert.throws(() => parseCommissionTransactionFilters(new URLSearchParams("level=0")));
  assert.throws(() => parseCommissionTransactionFilters(new URLSearchParams("from=2026-11-01&to=2026-10-01")));
});
