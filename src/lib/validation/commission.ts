import { z } from "zod";

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), "Enter a valid date.");
const percentageSchema = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, "Use a percentage with up to two decimal places.").transform((value) => Math.round(Number(value) * 100)).refine((value) => value >= 1 && value <= 10_000, "Percentage must be between 0.01 and 100.");
const fixedAmountSchema = z.string().regex(/^\d+$/, "Use a whole non-negative minor-unit amount.").refine((value) => BigInt(value) > 0n, "Fixed amount must be greater than zero.");

/** Supported types and bases exactly mirror the existing commission engine. */
export const commissionRuleInputSchema = z.object({
  name: z.string().trim().min(2).max(150),
  commissionType: z.enum(["DIRECT", "LEVEL"]),
  level: z.number().int().min(1).max(100).optional(),
  calculationBasis: z.enum(["ORDER_SUBTOTAL", "ORDER_TOTAL", "PV", "BV"]),
  rewardType: z.enum(["PERCENTAGE", "FIXED"]),
  percentage: percentageSchema.optional(),
  fixedAmountMinor: fixedAmountSchema.optional(),
  active: z.boolean(),
  effectiveFrom: dateSchema,
  effectiveTo: z.union([dateSchema, z.literal("")]).optional(),
}).strict().superRefine((value, context) => {
  if (value.commissionType === "DIRECT" && value.level !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["level"], message: "Direct rules cannot have a level." });
  if (value.commissionType === "LEVEL" && value.level === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["level"], message: "Choose a level for a level rule." });
  if (value.rewardType === "PERCENTAGE" && value.percentage === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["percentage"], message: "Enter a percentage." });
  if (value.rewardType === "FIXED" && value.fixedAmountMinor === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["fixedAmountMinor"], message: "Enter a fixed minor-unit amount." });
  if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveTo"], message: "End date must be after the effective date." });
});

export type CommissionRuleInput = z.infer<typeof commissionRuleInputSchema>;
