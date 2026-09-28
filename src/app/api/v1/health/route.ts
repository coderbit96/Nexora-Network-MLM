import { apiSuccess, withApiErrorHandling } from "@/lib/api";

export const GET = withApiErrorHandling(async () => apiSuccess({ status: "ok", timestamp: new Date().toISOString() }));
