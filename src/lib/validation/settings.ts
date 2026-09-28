import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max);
const minorAmount = z.string().regex(/^\d+$/, "Use a whole non-negative minor-unit amount.");

export const businessSettingsSchema = z.object({
  company: z.object({
    legalName: z.string().trim().min(2).max(160),
    tradingName: optionalText(160),
    website: z.union([z.literal(""), z.string().trim().url("Enter a valid website URL.")]),
    address: z.object({ line1: optionalText(160), line2: optionalText(160), city: optionalText(100), state: optionalText(100), postalCode: optionalText(24), country: optionalText(100) }).strict(),
  }).strict(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter ISO currency code."),
  withdrawal: z.object({
    minimumMinor: minorAmount.refine((value) => BigInt(value) > 0n, "Minimum withdrawal must be greater than zero."),
    maximumEnabled: z.boolean(),
    maximumMinor: z.union([z.literal(""), minorAmount]),
    requirePaymentDetails: z.boolean(),
  }).strict().superRefine((value, context) => {
    if (value.maximumEnabled && !value.maximumMinor) context.addIssue({ code: z.ZodIssueCode.custom, path: ["maximumMinor"], message: "Provide a maximum withdrawal amount or disable the maximum." });
    if (value.maximumEnabled && value.maximumMinor && BigInt(value.maximumMinor) < BigInt(value.minimumMinor)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["maximumMinor"], message: "Maximum withdrawal cannot be lower than the minimum." });
  }),
  commission: z.object({
    minimumEligibleOrderMinor: minorAmount,
    eligibleEvent: z.literal("PAYMENT_SUCCESS"),
    plan: z.literal("DIRECT_AND_LEVEL"),
  }).strict(),
  commerce: z.object({
    orderNumberPrefix: z.string().trim().toUpperCase().regex(/^[A-Z]{2,8}$/, "Use 2–8 uppercase letters."),
    inventoryTracking: z.literal(true),
    paymentRequiredBeforeFulfillment: z.literal(true),
  }).strict(),
  contact: z.object({
    supportEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid support email.")]),
    supportPhone: optionalText(40),
    whatsappNumber: z.union([z.literal(""), z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Enter an international phone number.")]),
  }).strict(),
}).strict();

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export const defaultBusinessSettings: BusinessSettings = {
  company: { legalName: "Nexora Network", tradingName: "Nexora", website: "", address: { line1: "", line2: "", city: "", state: "", postalCode: "", country: "" } },
  currency: "INR",
  withdrawal: { minimumMinor: "10000", maximumEnabled: false, maximumMinor: "", requirePaymentDetails: true },
  commission: { minimumEligibleOrderMinor: "0", eligibleEvent: "PAYMENT_SUCCESS", plan: "DIRECT_AND_LEVEL" },
  commerce: { orderNumberPrefix: "ORD", inventoryTracking: true, paymentRequiredBeforeFulfillment: true },
  contact: { supportEmail: "", supportPhone: "", whatsappNumber: "" },
};
