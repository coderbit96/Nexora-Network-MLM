import { z } from "zod";

import { strongPasswordSchema } from "@/lib/validation/password";

const displayNameSchema = z.string().trim().min(2, "Enter a staff name.").max(120);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const roleIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid role.");
const statusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]);
const referralCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,32}$/, "Enter a valid sponsor referral code.");

/** Staff identity fields intentionally exclude arbitrary roles and permissions. */
export const createStaffSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: strongPasswordSchema,
  roleId: roleIdSchema,
  status: statusSchema.default("PENDING"),
  firstName: z.string().trim().min(1, "Enter a first name.").max(80).optional(),
  lastName: z.string().trim().min(1, "Enter a last name.").max(80).optional(),
  sponsorReferralCode: referralCodeSchema.optional().or(z.literal("")),
}).strict();

export const updateStaffSchema = z.object({
  name: displayNameSchema.optional(),
  roleId: roleIdSchema.optional(),
  status: statusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one staff field to update.");

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
