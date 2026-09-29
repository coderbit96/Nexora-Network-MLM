import type { WithdrawalStatus } from "@/types/domain";

export const WITHDRAWAL_TRANSITIONS: Readonly<Record<WithdrawalStatus, readonly WithdrawalStatus[]>> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PROCESSING"],
  PROCESSING: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionWithdrawal(from: WithdrawalStatus, to: WithdrawalStatus) {
  return WITHDRAWAL_TRANSITIONS[from].includes(to);
}

export function assertWithdrawalTransition(from: WithdrawalStatus, to: WithdrawalStatus) {
  if (!canTransitionWithdrawal(from, to)) throw new Error(`Invalid withdrawal transition: ${from} to ${to}.`);
}
