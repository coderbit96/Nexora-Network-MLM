import assert from "node:assert/strict";
import test from "node:test";

import { defaultDashboardPath, postLoginPath } from "@/lib/auth/dashboard-routing";

test("each application role resolves to its correct dashboard", () => {
  assert.equal(defaultDashboardPath(["SUPER_ADMIN"]), "/admin");
  assert.equal(defaultDashboardPath(["ADMIN"]), "/admin");
  assert.equal(defaultDashboardPath(["STAFF"]), "/staff");
  assert.equal(defaultDashboardPath(["MEMBER"]), "/member");
});

test("post-login routing preserves only destinations in the resolved workspace", () => {
  assert.equal(postLoginPath("/admin/withdrawals", ["ADMIN"]), "/admin/withdrawals");
  assert.equal(postLoginPath("/admin", ["STAFF"]), "/staff");
  assert.equal(postLoginPath("/member/orders", ["MEMBER"]), "/member/orders");
  assert.equal(postLoginPath("//attacker.example", ["MEMBER"]), "/member");
});
