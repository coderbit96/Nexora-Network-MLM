import { z } from "zod";

import { objectIdSchema } from "@/lib/validation/request";

export const cartItemSchema = z.object({ productId: objectIdSchema, quantity: z.coerce.number().int().min(1).max(100) });
export const checkoutSchema = z.object({ idempotencyKey: z.string().uuid("Invalid checkout request identifier.") });
export const orderStatusSchema = z.object({ status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]), note: z.string().trim().max(500).optional() });
