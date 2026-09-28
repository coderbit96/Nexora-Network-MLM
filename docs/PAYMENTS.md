# Payment architecture

## Trust boundary

The browser can start a payment only. It cannot mark an order paid, settle a payment, or start commissions. `PaymentService` accepts settlement results only from a provider verification call or a provider-authenticated webhook. A return URL is purely a user-experience redirect and has no accounting effect.

Checkout creates an immutable-priced `PAYMENT_PENDING` order and one `Payment` record in `CREATED` state. Starting payment moves the record to `PENDING`. A verified provider result may move it to `SUCCESS`, `FAILED`, or `REFUNDED`.

On a verified `SUCCESS`, one MongoDB transaction records the provider result, transitions the order to `PAID`, records `paidAt`, and sets `commissionStatus` to `PENDING`. Only after that transaction commits does `CommissionService.processEligibleOrder()` run. Its own order claim and unique commission/ledger indexes make retries safe.

## Provider contract

`src/services/payments/payment-provider.ts` defines the adapter boundary:

- `createPayment()` creates or initiates a provider payment from server-owned amount, currency, order ID, and idempotency key.
- `verifyPayment()` obtains the authoritative provider state.
- `handleWebhook()` validates the provider signature over the raw request and normalizes the event.
- `refundPayment()` is optional because not every provider supports refunds.

`payment-provider-registry.ts` is the only selection point. A real adapter should implement the interface, be registered there, and be selected through `PAYMENT_PROVIDER`; order, commission, and route code must not import a gateway SDK.

For a real provider, add its server-only credentials to environment configuration, pass `Payment.idempotencyKey` to the provider, persist only the normalized provider transaction ID and safe payload fields, verify every webhook signature using the raw body, and configure the provider to call `/api/v1/payments/webhooks/<provider>`. Map only verified provider states to the normalized payment states. Keep a browser return route informational; it should request server-side verification rather than assert success.

## Webhook idempotency

Each accepted webhook creates a `PaymentWebhookEvent` keyed by the unique `(provider, eventId)` pair and stores a SHA-256 payload hash. A duplicate key completes without re-settling the payment. The payment also has a unique `(provider, providerTransactionId)` identity. Both constraints are created by `npm run db:indexes`.

## Development mock provider

`mock` is explicitly development-only. It is enabled only when `PAYMENT_PROVIDER=mock`, `PAYMENT_MOCK_ENABLED=true`, and `NODE_ENV` is not `production`. The member order page labels it as a simulator and offers a separate “Simulate successful payment” action. This action is blocked in production and must never be interpreted as a real transaction.

The mock webhook verifies an HMAC SHA-256 `x-mock-signature` header with `PAYMENT_WEBHOOK_SECRET`; it exists to exercise the same signed-webhook shape locally, not to provide production payment processing.
