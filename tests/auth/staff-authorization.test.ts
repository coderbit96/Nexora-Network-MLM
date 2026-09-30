import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { PERMISSION } from "@/config/permissions";
import { createStaffSchema, updateStaffSchema } from "@/lib/validation/staff";
import {
  canApplyStaffStatus,
  canAssignMemberRole,
  canAssignStaffRole,
  canCreateMember,
  canCreateStaff,
  canManageStaffTarget,
  type AssignableStaffRole,
} from "@/services/auth/staff-authorization";

const id = () => new Types.ObjectId();
const staffRole = (overrides: Partial<AssignableStaffRole> = {}): AssignableStaffRole => ({
  _id: id(), name: "Finance staff", slug: "finance-staff", baseRole: "STAFF", permissions: [PERMISSION.WITHDRAWALS.VIEW_ALL], isActive: true, ...overrides,
});

const adminActor = {
  status: "ACTIVE" as const,
  roles: ["ADMIN" as const],
  permissions: [PERMISSION.STAFF.VIEW, PERMISSION.STAFF.CREATE, PERMISSION.STAFF.EDIT, PERMISSION.STAFF.DISABLE, PERMISSION.ROLES.ASSIGN, PERMISSION.WITHDRAWALS.VIEW_ALL],
};

test("staff payloads reject raw role injection and unrestricted fields", () => {
  assert.equal(createStaffSchema.safeParse({ name: "Unsafe Request", email: "unsafe@example.test", role: "SUPER_ADMIN" }).success, false);
  assert.equal(createStaffSchema.safeParse({ name: "Unsafe Request", email: "unsafe@example.test", roleId: id().toString(), permissions: [PERMISSION.SYSTEM.MANAGE] }).success, false);
  assert.equal(createStaffSchema.safeParse({ name: "No password", email: "staff@example.test", roleId: id().toString(), status: "ACTIVE" }).success, false);
  assert.equal(createStaffSchema.safeParse({ name: "Short password", email: "staff@example.test", password: "12345", roleId: id().toString(), status: "ACTIVE" }).success, false);
  assert.equal(createStaffSchema.safeParse({ name: "Simple password", email: "staff@example.test", password: "simple", roleId: id().toString(), status: "ACTIVE" }).success, true);
  assert.equal(updateStaffSchema.safeParse({ role: "SUPER_ADMIN" }).success, false);
});

test("an administrator can assign only staff roles whose grants they already hold", () => {
  assert.equal(canCreateStaff(adminActor), true);
  assert.equal(canAssignStaffRole(adminActor, staffRole()), true);
  assert.equal(canAssignStaffRole(adminActor, staffRole({ baseRole: "ADMIN" })), false);
  assert.equal(canAssignStaffRole(adminActor, staffRole({ baseRole: "SUPER_ADMIN", name: "SUPER_ADMIN", slug: "super-admin", permissions: [] })), false);
  assert.equal(canAssignStaffRole(adminActor, staffRole({ permissions: [PERMISSION.SETTINGS.MANAGE] })), false);
});

test("member provisioning requires member-create and role-assignment grants", () => {
  const memberRole = staffRole({ baseRole: "MEMBER", name: "MEMBER", slug: "member", permissions: [PERMISSION.WITHDRAWALS.VIEW] });
  const memberCreator = { status: "ACTIVE" as const, roles: ["ADMIN" as const], permissions: [PERMISSION.MEMBERS.CREATE, PERMISSION.ROLES.ASSIGN, PERMISSION.WITHDRAWALS.VIEW] };
  assert.equal(canCreateMember(memberCreator), true);
  assert.equal(canAssignMemberRole(memberCreator, memberRole), true);
  assert.equal(canAssignMemberRole({ ...memberCreator, permissions: [PERMISSION.MEMBERS.CREATE, PERMISSION.ROLES.ASSIGN] }, memberRole), false);
  assert.equal(canAssignMemberRole(memberCreator, staffRole()), false);
});

test("only an explicit super admin can create or manage privileged staff accounts", () => {
  const superAdmin = { status: "ACTIVE" as const, roles: ["SUPER_ADMIN" as const], permissions: [] };
  const superRole = staffRole({ baseRole: "SUPER_ADMIN", name: "SUPER_ADMIN", slug: "super-admin", permissions: [] });
  const adminRole = staffRole({ baseRole: "ADMIN", name: "ADMIN", slug: "admin", permissions: [PERMISSION.STAFF.VIEW] });

  assert.equal(canAssignStaffRole(superAdmin, superRole), false);
  assert.equal(canAssignStaffRole(superAdmin, adminRole), true);
  assert.equal(canManageStaffTarget(adminActor, "actor", "super", [{ baseRole: "SUPER_ADMIN" }]), false);
  assert.equal(canManageStaffTarget(adminActor, "actor", "admin", [{ baseRole: "ADMIN" }]), false);
  assert.equal(canManageStaffTarget(superAdmin, "actor", "super", [{ baseRole: "SUPER_ADMIN" }]), false);
  assert.equal(canManageStaffTarget(superAdmin, "actor", "actor", [{ baseRole: "SUPER_ADMIN" }]), false);
});

test("status controls retain separate edit and disable permissions", () => {
  const editOnly = { status: "ACTIVE" as const, roles: ["STAFF" as const], permissions: [PERMISSION.STAFF.EDIT] };
  const disableOnly = { status: "ACTIVE" as const, roles: ["STAFF" as const], permissions: [PERMISSION.STAFF.DISABLE] };

  assert.equal(canApplyStaffStatus(editOnly, "ACTIVE"), true);
  assert.equal(canApplyStaffStatus(editOnly, "SUSPENDED"), true);
  assert.equal(canApplyStaffStatus(editOnly, "DISABLED"), false);
  assert.equal(canApplyStaffStatus(disableOnly, "DISABLED"), true);
  assert.equal(canApplyStaffStatus(disableOnly, "ACTIVE"), false);
});

test("a staff creator without status authority cannot provision an immediately usable account", () => {
  const createOnly = { status: "ACTIVE" as const, roles: ["STAFF" as const], permissions: [PERMISSION.STAFF.CREATE, PERMISSION.ROLES.ASSIGN] };

  assert.equal(canCreateStaff(createOnly), true);
  assert.equal(canApplyStaffStatus(createOnly, "ACTIVE"), false);
  assert.equal(canApplyStaffStatus(createOnly, "SUSPENDED"), false);
  assert.equal(canApplyStaffStatus(createOnly, "DISABLED"), false);
});
