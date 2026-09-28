import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth/authorization";

export const GET = withApiErrorHandling(async (request: Request) => {
  const context = await requireAuth(request);
  return apiSuccess({ userId: context.userId, email: context.user.email, displayName: context.user.displayName, roles: context.roles });
});
