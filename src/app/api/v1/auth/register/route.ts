import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit/memory-rate-limit";
import { parseJsonBody } from "@/lib/validation/request";
import { registrationSchema } from "@/lib/validation/auth";
import { registerApplicationUser } from "@/services/auth/registration";

export const POST = withApiErrorHandling(async (request: Request) => {
  enforceRateLimit(`register:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 5, 60_000);
  const input = await parseJsonBody(request, registrationSchema);
  const registered = await registerApplicationUser({ ...input, referralCode: input.referralCode || undefined });
  return apiSuccess(registered, { status: 201 });
});
