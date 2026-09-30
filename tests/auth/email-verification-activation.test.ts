import assert from "node:assert/strict";
import test from "node:test";

import { EMAIL_VERIFICATION_ACTIVATABLE_STATUSES } from "@/lib/auth/email-verification";

test("verified-email activation never re-enables suspended or disabled application accounts", () => {
  assert.deepEqual(EMAIL_VERIFICATION_ACTIVATABLE_STATUSES, ["PENDING", "ACTIVE"]);
  assert.equal(EMAIL_VERIFICATION_ACTIVATABLE_STATUSES.includes("SUSPENDED" as never), false);
  assert.equal(EMAIL_VERIFICATION_ACTIVATABLE_STATUSES.includes("DISABLED" as never), false);
});

test("verified-email activation remains safe to repeat for an already active account", () => {
  assert.equal(EMAIL_VERIFICATION_ACTIVATABLE_STATUSES.includes("ACTIVE"), true);
  assert.equal(EMAIL_VERIFICATION_ACTIVATABLE_STATUSES.includes("PENDING"), true);
});
