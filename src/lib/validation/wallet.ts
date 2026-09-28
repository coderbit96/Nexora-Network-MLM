import { z } from "zod";

export const adminWalletAdjustmentSchema = z.object({
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount with at most two decimal places.").refine((value) => value !== "0" && value !== "0.0" && value !== "0.00", "Amount must be greater than zero."),
  reason: z.string().trim().min(10, "Provide a reason of at least 10 characters.").max(500),
  idempotencyKey: z.string().uuid("Invalid adjustment request identifier."),
});
