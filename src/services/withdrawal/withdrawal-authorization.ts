import { PERMISSION, type PermissionKey } from "@/config/permissions";
import { hasPermission, type AuthorizationSnapshot } from "@/lib/auth/policy";
import type { WithdrawalStatus } from "@/types/domain";
import { canTransitionWithdrawal, WITHDRAWAL_TRANSITIONS } from "./withdrawal-transitions";

/**
 * Administrative withdrawal actions deliberately have separate permissions.
 * This mapping is the single source of truth for both the route handler and
 * the admin UI capability response; it must never be replaced by a broad
 * financial "manage" permission.
 */
export const ADMIN_WITHDRAWAL_TRANSITION_PERMISSION = {
  APPROVED: PERMISSION.WITHDRAWALS.APPROVE,
  REJECTED: PERMISSION.WITHDRAWALS.REJECT,
  PROCESSING: PERMISSION.WITHDRAWALS.PROCESS,
  COMPLETED: PERMISSION.WITHDRAWALS.COMPLETE,
} as const satisfies Record<string, PermissionKey>;

export type AdministrativeWithdrawalStatus = keyof typeof ADMIN_WITHDRAWAL_TRANSITION_PERMISSION;

export function isAdministrativeWithdrawalStatus(status: WithdrawalStatus): status is AdministrativeWithdrawalStatus {
  return Object.hasOwn(ADMIN_WITHDRAWAL_TRANSITION_PERMISSION, status);
}

export function permissionForAdministrativeWithdrawalTransition(status: AdministrativeWithdrawalStatus): PermissionKey {
  return ADMIN_WITHDRAWAL_TRANSITION_PERMISSION[status];
}

/**
 * A capability is granted only when both rules agree: the transition is legal
 * for the current withdrawal state and the actor holds that exact permission.
 */
export function canAdministrativelyTransitionWithdrawal(
  authorization: AuthorizationSnapshot,
  from: WithdrawalStatus,
  to: AdministrativeWithdrawalStatus,
) {
  return canTransitionWithdrawal(from, to)
    && hasPermission(authorization, permissionForAdministrativeWithdrawalTransition(to));
}

/** Returns only valid, authorized next admin states for a single withdrawal. */
export function allowedAdministrativeWithdrawalTransitions(
  authorization: AuthorizationSnapshot,
  from: WithdrawalStatus,
): AdministrativeWithdrawalStatus[] {
  return WITHDRAWAL_TRANSITIONS[from]
    .filter(isAdministrativeWithdrawalStatus)
    .filter((to) => canAdministrativelyTransitionWithdrawal(authorization, from, to));
}
