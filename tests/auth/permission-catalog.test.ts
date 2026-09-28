import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION, PERMISSION_BY_KEY, PERMISSION_CATALOG, PERMISSIONS, isPermissionKey } from "@/config/permissions";

test("permission catalog has unique, strongly typed resource.action keys", () => {
  assert.equal(PERMISSIONS.length, new Set(PERMISSIONS).size);
  assert.equal(PERMISSION_CATALOG.length, PERMISSIONS.length);
  assert.equal(isPermissionKey(PERMISSION.WALLET.ADJUST), true);
  assert.equal(isPermissionKey("wallet.adjustment"), false);
  assert.match(PERMISSION.ROLES.ASSIGN, /^[a-z]+\.[A-Za-z]+$/);
});

test("sensitive permission metadata marks high-impact operations", () => {
  for (const key of [PERMISSION.WALLET.ADJUST, PERMISSION.WITHDRAWALS.APPROVE, PERMISSION.WITHDRAWALS.COMPLETE, PERMISSION.COMMISSIONS.MANAGE_RULES, PERMISSION.PAYMENTS.REFUND, PERMISSION.ROLES.ASSIGN, PERMISSION.SETTINGS.MANAGE, PERMISSION.SYSTEM.MANAGE]) {
    assert.equal(PERMISSION_BY_KEY[key].sensitive, true);
  }
});
