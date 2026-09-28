import { z } from "zod";

export const withdrawalRequestSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount with at most two decimal places.").refine((value) => value !== "0" && value !== "0.0" && value !== "0.00", "Amount must be greater than zero."),
  idempotencyKey: z.string().uuid("Invalid withdrawal request identifier."),
});

export const withdrawalTransitionSchema = z.object({
  status: z.enum(["APPROVED", "PROCESSING", "COMPLETED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
  paymentReference: z.string().trim().min(1, "Payment reference is required when completing a withdrawal.").max(160).optional(),
}).superRefine((value, context) => {
  if (value.status === "REJECTED" && (!value.note || value.note.length < 3)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "A rejection reason is required." });
  if (value.status === "COMPLETED" && !value.paymentReference) context.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentReference"], message: "Payment reference is required." });
});

export const withdrawalCancelSchema = z.object({ note: z.string().trim().max(500).optional() });
