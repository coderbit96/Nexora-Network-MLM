# API contract

Route handlers live under `/api/v1`. They accept JSON only where applicable and return a common envelope:

```json
{ "success": true, "data": {} }
```

Failures return `{ "success": false, "error": { "code": "…", "message": "safe public message" } }`. Typical statuses are `400` validation failure, `401` missing/invalid identity, `403` authorization failure, `404` unavailable resource, `409` state/idempotency conflict, `422` business rule failure, and `429` rate limit. Internal error details are logged server-side only.

## Authentication

Protected browser calls include a Firebase ID token in `Authorization: Bearer <token>`. The server verifies it with Firebase Admin, looks up the application user, requires `ACTIVE` status, and checks roles/permissions. A body role, member ID, amount, order total, provider success flag, or wallet balance is never authoritative.

Public authentication endpoints support registration/referral validation, account synchronization, email verification synchronization, and password-reset support. Firebase handles credential operations; MongoDB holds application identity and authorization.

## Module map

| Module | Examples | Authorization |
| --- | --- | --- |
| Auth and registration | `/auth/*`, `/members/register`, referral validation | Public/rate limited; server creates identity/profile only after validation. |
| Member profile/network | `/members/me`, `/members/me/referral`, `/genealogy/*` | Active member; resources are scoped to caller unless an authorized admin inspects them. |
| Catalogue/cart/orders | `/catalog/*`, `/cart`, `/orders/*` | Public catalogue read; cart/order ownership checks; admin order mutations require `orders.manage`. |
| Payments | `/payments/orders/:id`, provider webhook routes | Member owns order for initiation; settlement is provider-verified; webhook identity is idempotent. |
| Wallet/withdrawals | `/wallet/*`, `/withdrawals/*` | Member owns wallet/request; admin actions require wallet/withdrawal permission and transition checks. |
| Commissions | `/commissions/*` | Member sees own transactions; staff/admin require configured commission permission. |
| Administration | `/admin/members`, products, categories, staff, roles, permissions, settings, audits | Permission-specific server enforcement. Super Admin bypasses individual permission keys. |
| Reports | `/admin/reports/*` | `reports.read`; bounded date/query/pagination filters and streaming/bounded CSV behavior. |
| Notifications | `/notifications/*` | User-scoped read/mark operations; admin operational notifications remain permission gated. |

The exact available route files are the source of truth. New handlers must use response/error helpers, Zod schemas, authorization guards, bounded query parameters, and audit logging for sensitive changes.

## Mutation requirements

1. Parse and bound input with the module Zod schema.
2. Authenticate and authorize on the server.
3. Re-read trusted model data (product price, commission rules, wallet balance, role, state) on the server.
4. Execute transactional/idempotent domain service logic where the mutation affects finance, stock, or relationship integrity.
5. Return a safe response, create an audit record if required, and avoid logging tokens, secrets, or full bank data.

## Pagination and exports

List and report endpoints use server-side filters and bounded page sizes. CSV/report processing must not hydrate an unbounded collection in the browser. Date/member/status filters are validated and MongoDB query syntax from request values is never merged directly into a query.
