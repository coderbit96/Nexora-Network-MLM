export const APP_NAME = "Nexora Network";
export const DEFAULT_CURRENCY = "INR";
export const API_VERSION = "v1";

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export const WITHDRAWAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
