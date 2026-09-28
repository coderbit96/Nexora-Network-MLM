import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION } from "@/config/permissions";
import { createRoleSchema, updateRoleSchema } from "@/lib/validation/roles";

test("custom roles accept only supported base roles and catalog permissions", () => {
  const role = createRoleSchema.parse({
    name: "Finance Manager",
    slug: "finance-manager",
    description: "Reviews financial operations.",
    baseRole: "STAFF",
    permissions: [PERMISSION.WALLET.VIEW_ALL, PERMISSION.WITHDRAWALS.VIEW_ALL],
  });
  assert.deepEqual(role.permissions, [PERMISSION.WALLET.VIEW_ALL, PERMISSION.WITHDRAWALS.VIEW_ALL]);

  assert.throws(() => createRoleSchema.parse({ name: "ADMIN", slug: "another-admin", baseRole: "ADMIN", permissions: [] }), /reserved/i);
  assert.throws(() => createRoleSchema.parse({ name: "Unsafe", slug: "unsafe", baseRole: "SUPER_ADMIN", permissions: [] }), /Invalid enum value/i);
  assert.throws(() => createRoleSchema.parse({ name: "Unsafe", slug: "unsafe", baseRole: "STAFF", permissions: ["wallet.unrestricted"] }), /Unknown permission/i);
});

test("role edits retain explicit empty permission sets and active state", () => {
  const update = updateRoleSchema.parse({ description: null, permissions: [], isActive: false });
  assert.deepEqual(update.permissions, []);
  assert.equal(update.isActive, false);
});
