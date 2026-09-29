import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION } from "@/config/permissions";
import type { AuthorizationSnapshot } from "@/lib/auth/policy";
import { canCreateRoleDefinition, canManageRoleDefinition } from "@/services/auth/role-authorization";

const actor: AuthorizationSnapshot = { status: "ACTIVE", roles: ["ADMIN"], permissions: [PERMISSION.ROLES.CREATE, PERMISSION.ROLES.EDIT, PERMISSION.MEMBERS.VIEW] };
const limitedRole = { baseRole: "STAFF" as const, isSystem: false, permissions: [PERMISSION.MEMBERS.VIEW] };

test("role editors cannot escalate through role definitions or modify system roles", () => {
  assert.equal(canCreateRoleDefinition(actor, limitedRole), true);
  assert.equal(canManageRoleDefinition(actor, { ...limitedRole, permissions: [PERMISSION.WALLET.ADJUST] }), false);
  assert.equal(canCreateRoleDefinition(actor, { ...limitedRole, baseRole: "ADMIN" }), false);
  assert.equal(canManageRoleDefinition(actor, { ...limitedRole, baseRole: "SUPER_ADMIN" }), false);
  assert.equal(canManageRoleDefinition(actor, { ...limitedRole, isSystem: true }), false);
  assert.equal(canManageRoleDefinition({ ...actor, status: "SUSPENDED" }, limitedRole), false);
  assert.equal(canManageRoleDefinition({ ...actor, roles: ["SUPER_ADMIN"], permissions: [] }, { ...limitedRole, baseRole: "ADMIN" }), true);
});
