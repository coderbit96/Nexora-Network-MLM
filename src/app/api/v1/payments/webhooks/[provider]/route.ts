import { apiSuccess, withApiErrorHandling } from "@/lib/api";
import { PaymentService } from "@/services/payments/payment-service";
import { readBoundedWebhookBody, webhookProviderSchema } from "@/lib/validation/webhook";

export const POST = withApiErrorHandling(async (request: Request, { params }: { params: Promise<{ provider: string }> }) => { const provider = webhookProviderSchema.parse((await params).provider); const rawBody = await readBoundedWebhookBody(request); return apiSuccess(await PaymentService.handleWebhook(provider, rawBody, request.headers)); });
