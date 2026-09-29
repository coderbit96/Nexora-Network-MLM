import { z } from "zod";

const phoneSchema = z.string().trim().min(7).max(30).regex(/^[+\d()\s-]+$/, "Enter a valid phone number.");
const addressSchema = z.object({ line1: z.string().trim().min(2).max(160), line2: z.string().trim().max(160).optional().or(z.literal("")), city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(100), postalCode: z.string().trim().min(3).max(24), country: z.string().trim().length(2).toUpperCase() });

export const updateMemberProfileSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phone: phoneSchema.optional().or(z.literal("")), alternatePhone: phoneSchema.optional().or(z.literal("")), address: addressSchema.optional().nullable() });

/**
 * The administration API deliberately accepts only profile fields. Financial
 * records, identity email, roles, and referral relationships each have their
 * own audited workflows and must never be mass-assigned from this form.
 */
export const adminMemberProfileUpdateSchema = updateMemberProfileSchema.strict();

export const adminMemberStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
  reason: z.string().trim().max(500).optional(),
}).strict().superRefine((value, context) => {
  if ((value.status === "SUSPENDED" || value.status === "DISABLED") && (!value.reason || value.reason.trim().length < 10)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Give a reason of at least 10 characters for this account restriction." });
  }
});

export type AdminMemberProfileUpdateInput = z.infer<typeof adminMemberProfileUpdateSchema>;
export type AdminMemberStatusInput = z.infer<typeof adminMemberStatusSchema>;

export const paymentDetailsSchema = z.object({ accountHolderName: z.string().trim().min(2).max(120), bankName: z.string().trim().min(2).max(120), accountNumber: z.string().trim().min(6).max(34).regex(/^\d+$/, "Account number must contain digits only."), ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code.") });
export const notificationReadSchema = z.union([z.object({ all: z.literal(true) }).strict(), z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i, "Invalid notification identifier.")).min(1).max(100) }).strict()]);
