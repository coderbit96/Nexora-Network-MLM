import assert from "node:assert/strict";
import test from "node:test";

import { shouldReleasePaymentInitializationClaim } from "@/services/payments/payment-service";

test("a payment initialization claim is never reopened after an external provider call starts", () => {
  assert.equal(shouldReleasePaymentInitializationClaim(false), true);
  assert.equal(shouldReleasePaymentInitializationClaim(true), false);
});
