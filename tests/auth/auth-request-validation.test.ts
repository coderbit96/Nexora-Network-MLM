import assert from "node:assert/strict";
import test from "node:test";

import { registrationSchema, sessionSchema } from "@/lib/validation/auth";
import { isStrongPassword } from "@/lib/validation/password";

test("registration accepts a valid referral and normalizes it for server-side sponsor lookup", () => {
  const registration = registrationSchema.parse({ firstName: "B", lastName: "Member", email: "member@example.test", password: "SecurePassword123", referralCode: "ref000001" });
  assert.equal(registration.referralCode, "REF000001");
});

test("registration rejects unsafe referral values and weak credentials", () => {
  assert.equal(registrationSchema.safeParse({ firstName: "B", lastName: "Member", email: "member@example.test", password: "short", referralCode: "{$ne:null}" }).success, false);
  assert.equal(registrationSchema.safeParse({ firstName: "B", lastName: "Member", email: "not-an-email", password: "SecurePassword123" }).success, false);
  assert.equal(registrationSchema.safeParse({ firstName: "B", lastName: "Member", email: "member@example.test", password: "SecurePassword123", role: "SUPER_ADMIN" }).success, false);
  assert.equal(registrationSchema.safeParse({ firstName: "B", lastName: "Member", email: "member@example.test", password: "SecurePassword123", roleIds: ["000000000000000000000000"] }).success, false);
  assert.equal(registrationSchema.safeParse({ firstName: "B", lastName: "Member", email: "member@example.test", password: "SecurePassword123", permissions: ["system.manage"] }).success, false);
});

test("the password reset and registration policy rejects weak but long passwords", () => {
  assert.equal(isStrongPassword("alllowercase123"), false);
  assert.equal(isStrongPassword("ALLUPPERCASE123"), false);
  assert.equal(isStrongPassword("SecurePassword123"), true);
});

test("session establishment rejects missing or implausibly short Firebase ID tokens", () => {
  assert.equal(sessionSchema.safeParse({}).success, false);
  assert.equal(sessionSchema.safeParse({ idToken: "short-token" }).success, false);
  assert.equal(sessionSchema.safeParse({ idToken: "x".repeat(50) }).success, true);
});
