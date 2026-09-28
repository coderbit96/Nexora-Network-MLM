import assert from "node:assert/strict";
import test from "node:test";

import { getServerEnv } from "../../src/lib/env";

const requiredEnvironment = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/test",
  MONGODB_DB_NAME: "test",
  FIREBASE_ADMIN_PROJECT_ID: "test-project",
  FIREBASE_ADMIN_CLIENT_EMAIL: "admin@test-project.iam.gserviceaccount.com",
  FIREBASE_ADMIN_PRIVATE_KEY: "test-private-key",
  PAYMENT_API_KEY: "test-payment-key",
  PAYMENT_WEBHOOK_SECRET: "test-webhook-secret",
  FIELD_ENCRYPTION_KEY: "test-encryption-key",
};

test("production environment rejects mock payment configuration", () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, requiredEnvironment, { NODE_ENV: "production", PAYMENT_PROVIDER: "mock", PAYMENT_MOCK_ENABLED: "true" });
    assert.throws(() => getServerEnv(), /Mock payments are prohibited/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
