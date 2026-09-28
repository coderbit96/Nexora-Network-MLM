import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog, CommissionTransaction, MemberProfile, Order, Withdrawal } from "@/models";

function hasIndex(model: { schema: { indexes(): Array<[Record<string, 1 | -1>, Record<string, unknown>]> } }, fields: string[]) {
  return model.schema.indexes().some(([keys]) => fields.every((field) => field in keys));
}

test("admin dashboard time-series queries have supporting indexes", () => {
  assert.equal(hasIndex(MemberProfile, ["createdAt"]), true);
  assert.equal(hasIndex(Order, ["paymentStatus", "paidAt"]), true);
  assert.equal(hasIndex(CommissionTransaction, ["status", "createdAt"]), true);
  assert.equal(hasIndex(Withdrawal, ["status", "completedAt"]), true);
  assert.equal(hasIndex(AuditLog, ["createdAt"]), true);
});
