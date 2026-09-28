import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseEnv, getFirebaseAdminEnv } from "../../src/lib/env";

test("Firebase Admin configuration is independent from payment provider configuration", () => {
  const original = { ...process.env };
  try {
    process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "admin@test-project.iam.gserviceaccount.com";
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-private-key";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
    process.env.MONGODB_DB_NAME = "test";
    delete process.env.PAYMENT_API_KEY;
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    assert.equal(getFirebaseAdminEnv().FIREBASE_ADMIN_PROJECT_ID, "test-project");
    assert.equal(getDatabaseEnv().MONGODB_DB_NAME, "test");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
