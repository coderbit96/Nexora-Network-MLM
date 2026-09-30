import { z } from "zod";

/** Firebase requires a minimum of six characters for email/password accounts. */
export const firebasePasswordSchema = z.string()
  .min(6, "Use at least 6 characters.")
  .max(128);

/** Shared password policy for every application-controlled credential entry point. */
export const strongPasswordSchema = z.string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.");

export function isStrongPassword(value: string) {
  return strongPasswordSchema.safeParse(value).success;
}
