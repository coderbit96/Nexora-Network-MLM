import { z } from "zod";

import { objectIdSchema } from "@/lib/validation/request";

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens.").max(180);
const decimalSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a non-negative amount with at most two decimal places.");
const wholeNumberSchema = z.coerce.number().int().min(0).max(10_000_000);

export const categoryCreateSchema = z.object({ name: z.string().trim().min(2).max(120), slug: slugSchema, description: z.string().trim().max(2000).optional().or(z.literal("")), status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE") });
export const categoryUpdateSchema = categoryCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one category field.");

const productFields = z.object({
  categoryId: objectIdSchema,
  name: z.string().trim().min(2).max(180),
  slug: slugSchema,
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/, "SKU must be 3–64 uppercase letters, numbers, underscores, or hyphens."),
  shortDescription: z.string().trim().max(360).optional().or(z.literal("")),
  description: z.string().trim().max(10_000).optional().or(z.literal("")),
  imageUrls: z.array(z.string().url().refine((value) => value.startsWith("https://"), "Image URLs must use HTTPS.")).max(8).default([]),
  price: decimalSchema,
  salePrice: decimalSchema.optional().or(z.literal("")),
  pv: z.string().regex(/^\d+$/, "PV must be a whole non-negative value.").default("0"),
  bv: z.string().regex(/^\d+$/, "BV must be a whole non-negative value.").default("0"),
  stockQuantity: wholeNumberSchema.default(0),
  commissionEligible: z.boolean().default(true),
  featured: z.boolean().default(false),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("DRAFT"),
});

export const productCreateSchema = productFields;
export const productUpdateSchema = productFields.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one product field.");
