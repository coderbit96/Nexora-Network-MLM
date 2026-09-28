import { z } from "zod";

import { strongPasswordSchema } from "@/lib/validation/password";

export const registrationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: strongPasswordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,32}$/, "Referral code is invalid.").optional().or(z.literal("")),
}).strict();

export const sessionSchema = z.object({ idToken: z.string().min(50, "A valid Firebase ID token is required.") });
