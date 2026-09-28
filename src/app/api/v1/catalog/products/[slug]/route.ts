import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { publicProductBySlug } from "@/services/catalog/catalog-query";

export const GET = withApiErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => apiSuccess(await publicProductBySlug((await params).slug)));
