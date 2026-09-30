import type { AccountStatus } from "@/types/domain";

/**
 * Firebase email verification only completes a pending application account.
 * It may be repeated for an active account, but must never undo an explicit
 * suspension or disablement made by an administrator.
 */
export const EMAIL_VERIFICATION_ACTIVATABLE_STATUSES = ["PENDING", "ACTIVE"] as const satisfies readonly AccountStatus[];
