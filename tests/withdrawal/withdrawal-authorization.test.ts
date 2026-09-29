import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION } from "@/config/permissions";
import type { AuthorizationSnapshot } from "@/lib/auth/policy";
import {
  ADMIN_WITHDRAWAL_TRANSITION_PERMISSION,
  allowedAdministrativeWithdrawalTransitions,
  canAdministrativelyTransitionWithdrawal,
  permissionForAdministrativeWithdrawalTransition,
  type AdministrativeWithdrawalStatus,
} from "@/services/withdrawal/withdrawal-authorization";
import { WITHDRAWAL_TRANSITIONS } from "@/services/withdrawal/withdrawal-transitions";
import type { WithdrawalStatus } from "@/types/domain";

const statuses: WithdrawalStatus[] = ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"];
const adminTargets = Object.keys(ADMIN_WITHDRAWAL_TRANSITION_PERMISSION) as AdministrativeWithdrawalStatus[];

function staff(permissions: AuthorizationSnapshot["permissions"] = []): AuthorizationSnapshot {
  return { status: "ACTIVE", roles: ["STAFF"], permissions };
}

test("every administrative transition uses its own catalog permission", () => {
  assert.equal(permissionForAdministrativeWithdrawalTransition("APPROVED"), PERMISSION.WITHDRAWALS.APPROVE);
  assert.equal(permissionForAdministrativeWithdrawalTransition("REJECTED"), PERMISSION.WITHDRAWALS.REJECT);
  assert.equal(permissionForAdministrativeWithdrawalTransition("PROCESSING"), PERMISSION.WITHDRAWALS.PROCESS);
  assert.equal(permissionForAdministrativeWithdrawalTransition("COMPLETED"), PERMISSION.WITHDRAWALS.COMPLETE);
});

test("each permission/state combination requires both an allowed transition and its exact permission", () => {
  for (const from of statuses) {
    for (const target of adminTargets) {
      const permission = permissionForAdministrativeWithdrawalTransition(target);
      const expected = WITHDRAWAL_TRANSITIONS[from].includes(target);

      assert.equal(
        canAdministrativelyTransitionWithdrawal(staff([permission]), from, target),
        expected,
        `${from} -> ${target} should be ${expected ? "allowed" : "blocked"} with ${permission}`,
      );
      assert.equal(
        canAdministrativelyTransitionWithdrawal(staff([]), from, target),
        false,
        `${from} -> ${target} must be blocked without ${permission}`,
      );
    }
  }
});

test("a finance staff member can see and approve only pending withdrawals", () => {
  const financeStaff = staff([PERMISSION.WITHDRAWALS.VIEW_ALL, PERMISSION.WITHDRAWALS.APPROVE]);

  assert.deepEqual(allowedAdministrativeWithdrawalTransitions(financeStaff, "PENDING"), ["APPROVED"]);
  assert.deepEqual(allowedAdministrativeWithdrawalTransitions(financeStaff, "APPROVED"), []);
  assert.equal(canAdministrativelyTransitionWithdrawal(financeStaff, "PENDING", "PROCESSING"), false);
  assert.equal(canAdministrativelyTransitionWithdrawal(financeStaff, "PROCESSING", "COMPLETED"), false);
});

test("a complete permission cannot bypass the approval and processing workflow", () => {
  const completionStaff = staff([PERMISSION.WITHDRAWALS.COMPLETE]);

  assert.equal(canAdministrativelyTransitionWithdrawal(completionStaff, "PENDING", "COMPLETED"), false);
  assert.equal(canAdministrativelyTransitionWithdrawal(completionStaff, "APPROVED", "COMPLETED"), false);
  assert.equal(canAdministrativelyTransitionWithdrawal(completionStaff, "PROCESSING", "COMPLETED"), true);
});

test("super admin still follows the state machine while receiving all valid capabilities", () => {
  const superAdmin: AuthorizationSnapshot = { status: "ACTIVE", roles: ["SUPER_ADMIN"], permissions: [] };

  assert.deepEqual(allowedAdministrativeWithdrawalTransitions(superAdmin, "PENDING"), ["APPROVED", "REJECTED"]);
  assert.deepEqual(allowedAdministrativeWithdrawalTransitions(superAdmin, "APPROVED"), ["PROCESSING"]);
  assert.deepEqual(allowedAdministrativeWithdrawalTransitions(superAdmin, "PROCESSING"), ["COMPLETED"]);
  assert.equal(canAdministrativelyTransitionWithdrawal(superAdmin, "PENDING", "COMPLETED"), false);
});

test("rejection and member cancellation are only available while a request is pending", () => {
  assert.equal(WITHDRAWAL_TRANSITIONS.PENDING.includes("REJECTED"), true);
  assert.equal(WITHDRAWAL_TRANSITIONS.PENDING.includes("CANCELLED"), true);
  assert.equal(WITHDRAWAL_TRANSITIONS.APPROVED.includes("REJECTED"), false);
  assert.equal(WITHDRAWAL_TRANSITIONS.PROCESSING.includes("REJECTED"), false);
  assert.equal(WITHDRAWAL_TRANSITIONS.APPROVED.includes("CANCELLED"), false);
});
