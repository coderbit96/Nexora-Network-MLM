import { PERMISSION } from "@/config/permissions";
import assert from "node:assert/strict";
import test from "node:test";

import { hasAllPermissions, hasAnyPermission, hasAnyRole, hasPermission, hasRole, isAccountActive } from "@/lib/auth/policy";

test("super admins bypass individual permission checks", () => {
  const admin = { status: "ACTIVE" as const, roles: ["SUPER_ADMIN" as const], permissions: [] };
  assert.equal(hasPermission(admin, PERMISSION.WALLET.ADJUST), true);
  assert.equal(hasRole(admin, "MEMBER"), true);
  assert.equal(hasAnyPermission(admin, [PERMISSION.WALLET.ADJUST, PERMISSION.ORDERS.REFUND]), true);
  assert.equal(hasAllPermissions(admin, [PERMISSION.WALLET.ADJUST, PERMISSION.ORDERS.REFUND]), true);
  assert.equal(hasPermission(admin, "arbitrary.permission"), false);
});

test("staff only receive configured permissions", () => {
  const staff = { status: "ACTIVE" as const, roles: ["STAFF" as const], permissions: [PERMISSION.MEMBERS.VIEW, PERMISSION.ORDERS.MANAGE] };
  assert.equal(hasPermission(staff, PERMISSION.MEMBERS.VIEW), true);
  assert.equal(hasPermission(staff, PERMISSION.WALLET.ADJUST), false);
  assert.equal(hasAnyPermission(staff, [PERMISSION.WALLET.ADJUST, PERMISSION.ORDERS.MANAGE]), true);
  assert.equal(hasAllPermissions(staff, [PERMISSION.MEMBERS.VIEW, PERMISSION.ORDERS.MANAGE]), true);
  assert.equal(hasAllPermissions(staff, [PERMISSION.MEMBERS.VIEW, PERMISSION.WALLET.ADJUST]), false);
  assert.equal(hasAnyRole(staff, ["ADMIN", "STAFF"]), true);
});

test("a custom staff role receives its server-side base-role boundary", () => {
  // The authorization context resolves custom role display names to base roles.
  // This is the resulting snapshot for a role such as Finance Manager.
  const financeManager = { status: "ACTIVE" as const, roles: ["STAFF" as const], permissions: [PERMISSION.WALLET.VIEW_ALL] };
  assert.equal(hasAnyRole(financeManager, ["ADMIN", "STAFF"]), true);
  assert.equal(hasPermission(financeManager, PERMISSION.WALLET.VIEW_ALL), true);
});

test("members retain their normal protected workspace role", () => {
  const member = { status: "ACTIVE" as const, roles: ["MEMBER" as const], permissions: [PERMISSION.WITHDRAWALS.VIEW] };
  assert.equal(hasRole(member, "MEMBER"), true);
  assert.equal(hasAnyRole(member, ["ADMIN", "STAFF"]), false);
  assert.equal(hasPermission(member, PERMISSION.WITHDRAWALS.VIEW), true);
  assert.equal(hasPermission(member, PERMISSION.WITHDRAWALS.VIEW_ALL), false);
});

test("admin and member permissions remain explicit", () => {
  const admin = { status: "ACTIVE" as const, roles: ["ADMIN" as const], permissions: [PERMISSION.MEMBERS.VIEW, PERMISSION.REPORTS.VIEW] };
  const member = { status: "ACTIVE" as const, roles: ["MEMBER" as const], permissions: [] };
  assert.equal(hasPermission(admin, PERMISSION.MEMBERS.VIEW), true);
  assert.equal(hasPermission(admin, PERMISSION.WALLET.ADJUST), false);
  assert.equal(hasPermission(member, PERMISSION.MEMBERS.VIEW), false);
  assert.equal(hasAnyPermission(member, [PERMISSION.MEMBERS.VIEW]), false);
});

test("inactive roles and non-active accounts never authorize", () => {
  const inactiveRole = { status: "ACTIVE" as const, roles: [], permissions: [PERMISSION.MEMBERS.VIEW] };
  const suspendedAdmin = { status: "SUSPENDED" as const, roles: ["SUPER_ADMIN" as const], permissions: [] };
  const disabledStaff = { status: "DISABLED" as const, roles: ["STAFF" as const], permissions: [PERMISSION.MEMBERS.VIEW] };
  assert.equal(hasPermission(inactiveRole, PERMISSION.MEMBERS.VIEW), false);
  assert.equal(hasPermission(suspendedAdmin, PERMISSION.SYSTEM.MANAGE), false);
  assert.equal(hasPermission(disabledStaff, PERMISSION.MEMBERS.VIEW), false);
});

test("only active accounts satisfy protected-request status checks", () => {
  assert.equal(isAccountActive("ACTIVE"), true);
  assert.equal(isAccountActive("PENDING"), false);
  assert.equal(isAccountActive("SUSPENDED"), false);
  assert.equal(isAccountActive("DISABLED"), false);
});
