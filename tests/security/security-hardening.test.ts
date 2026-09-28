import assert from "node:assert/strict";
import test from "node:test";

import { apiError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { notificationReadSchema } from "@/lib/validation/member";
import { MAX_WEBHOOK_BODY_BYTES, readBoundedWebhookBody, webhookProviderSchema } from "@/lib/validation/webhook";
import { escapeGenealogySearchTerm } from "@/services/genealogy/genealogy-utils";

test("genealogy search terms are escaped before becoming MongoDB regex patterns", () => {
  assert.equal(escapeGenealogySearchTerm("Ada.*(admin)[0]"), "Ada\\.\\*\\(admin\\)\\[0\\]");
});

test("notification mutations accept only explicit, bounded identifier payloads", () => {
  assert.equal(notificationReadSchema.safeParse({ all: true }).success, true);
  assert.equal(notificationReadSchema.safeParse({ ids: ["507f1f77bcf86cd799439011"] }).success, true);
  assert.equal(notificationReadSchema.safeParse({ ids: { $ne: null } }).success, false);
  assert.equal(notificationReadSchema.safeParse({ all: true, userId: "507f1f77bcf86cd799439011" }).success, false);
  assert.equal(notificationReadSchema.safeParse({ ids: [] }).success, false);
});

test("payment webhooks reject unsafe provider identifiers and declared oversized payloads", async () => {
  assert.equal(webhookProviderSchema.safeParse("mock").success, true);
  assert.equal(webhookProviderSchema.safeParse("../../mock").success, false);
  const request = new Request("https://example.test/api/v1/payments/webhooks/mock", { headers: { "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1) }, method: "POST", body: "{}" });
  await assert.rejects(readBoundedWebhookBody(request), /Webhook payload is too large/);
});

test("unexpected API errors never disclose internal messages to callers", async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const response = apiError(new Error("database password should never reach a caller"));
    assert.equal(response.status, 500);
    const body = await response.json() as { error: { code: string; message: string } };
    assert.deepEqual(body.error, { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
  } finally {
    console.error = originalError;
  }
});

test("rate limits use the correct HTTP status instead of reporting bad input", async () => {
  const key = `rate-limit-test:${Date.now()}`;
  enforceRateLimit(key, 1, 60_000);
  let caught: unknown;
  try { enforceRateLimit(key, 1, 60_000); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error);
  const response = apiError(caught);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "RATE_LIMITED");
});
