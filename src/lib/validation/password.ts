import { z } from "zod";

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
