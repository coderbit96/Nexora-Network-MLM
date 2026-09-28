import { z } from "zod";

import { errors } from "@/lib/errors/app-error";

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(request: Request, schema: TSchema): Promise<z.infer<TSchema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw errors.badRequest("Request body must contain valid JSON.");
  }

  return schema.parse(body);
}

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource identifier.");
