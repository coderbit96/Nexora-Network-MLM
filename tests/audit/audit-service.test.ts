import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "@/models";
import { getAuditRequestContext, sanitizeAuditValue } from "@/lib/security/audit-sanitization";

test("audit sanitization removes credentials and full banking values while retaining safe summaries", () => {
  const value = sanitizeAuditValue({ password: "do-not-log", authorization: "Bearer token", bankName: "Example Bank", accountNumber: "123456789", accountLast4: "6789", amountMinor: "12500" }) as Record<string, unknown>;
  assert.equal(value.password, "[redacted]");
  assert.equal(value.authorization, "[redacted]");
  assert.equal(value.bankName, "[redacted]");
  assert.equal(value.accountNumber, "[redacted]");
  assert.equal(value.accountLast4, "6789");
  assert.equal(value.amountMinor, "12500");
});

test("audit request context only retains a safe audit IP and bounded user agent", () => {
  const audit = getAuditRequestContext(new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.2", "user-agent": "Test Agent" } }));
  assert.equal(audit.ipAddress, "203.0.113.42");
  assert.equal(audit.userAgent, "Test Agent");
  assert.deepEqual(getAuditRequestContext(new Request("https://example.test", { headers: { "x-forwarded-for": "not an ip" } })), {});
});

test("audit records cannot be edited or deleted through normal query operations", async () => {
  await assert.rejects(AuditLog.updateOne({}, { $set: { action: "rewritten" } }).exec(), /immutable/i);
  await assert.rejects(AuditLog.deleteMany({}).exec(), /cannot be deleted/i);
});
