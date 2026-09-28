import { z } from "zod";

import { errors } from "@/lib/errors/app-error";

export const webhookProviderSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{1,40}$/, "Invalid payment provider.");
export const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

function assertDeclaredSize(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_WEBHOOK_BODY_BYTES)) throw errors.badRequest("Webhook payload is too large.");
}

/** Reads signed webhook payloads without buffering an unbounded request body. */
export async function readBoundedWebhookBody(request: Request) {
  assertDeclaredSize(request);
  if (!request.body) return "";
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_WEBHOOK_BODY_BYTES) { await reader.cancel(); throw errors.badRequest("Webhook payload is too large."); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}
