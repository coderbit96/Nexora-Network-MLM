# Architecture

## System boundaries

The application uses Next.js App Router. Server Components load initial, non-sensitive views; client components handle interaction only. Route handlers authenticate and validate requests, then call domain services. React components never calculate commissions, balances, order totals, permissions, or withdrawal eligibility.

```
Browser → Firebase ID token → Route handler → auth/authorization guard
        → Zod validation → domain service → Mongoose models / MongoDB transaction
        → immutable ledger, audit log, notification → API response
```

## Layers

- `src/app`: pages, layouts, loading/error boundaries, route handlers, robots, and sitemap.
- `src/components`: presentational public, member, admin, shared, and UI components.
- `src/lib`: server-only database/Firebase configuration, error/response helpers, validation, rate limiting, formatting, and permissions.
- `src/models`: Mongoose schemas and database constraints.
- `src/services`: business operations for members, genealogy, commission, wallet, withdrawal, orders, payments, notifications, audit, reports, and settings.
- `src/repositories`: reusable database access where a service benefits from a focused query boundary.
- `scripts`: manual operational tools, separate from application startup (`db:indexes`, `db:rbac`, development seed, production preflight).

## Identity and authorization

Firebase Authentication establishes a verified Firebase UID; it does not grant an application role. `requireAuth` verifies the bearer token server-side, loads the application `User`, requires an `ACTIVE` MongoDB account and at least one active role, then resolves each role's server-owned `baseRole` and permissions. The centralized authorization boundary provides `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `requirePermission`, `requireAnyPermission`, `requireAllPermissions`, and role equivalents. Every runtime permission is checked against the catalog first, so arbitrary strings never pass—even for Super Admin. The `MemberProfile.userId` unique reference is the one-to-one member extension of the user identity. Public registration accepts no role, permission, or status fields and always resolves the active `MEMBER` system role on the server. Super Admin is an explicit server-side bypass; client navigation visibility is only a usability convenience and is never authorization.

Admin page segments use the centralized `ADMIN_PAGE_PERMISSION` map and a server-rendered page guard. Missing identity redirects to the login page with a safe return path; a verified identity without the required permission invokes the application `forbidden` boundary and returns a 403. This is UX protection only: every admin API retains its own authorization check.

## Financial architecture

Money is represented as integer minor units (`bigint` in calculation code and integer-safe stored values), not JavaScript floating point. A `WalletTransaction` is immutable and is the historical record. `WalletService` is the only supported posting path; it atomically updates the wallet summary and appends a ledger record in a transaction. Corrections use compensating entries.

Withdrawals reserve funds when requested. Reserved funds are unavailable for a second request; rejection/cancellation releases them and completion settles the reservation. State transition maps reject skipped or terminal-state mutations.

## Commerce and commissions

`OrderService` retrieves authoritative product data, stock, current values, and commission eligibility from MongoDB, then stores immutable line snapshots. Payment settlement is provider/server verified, never browser asserted. A verified, commission-eligible event invokes `CommissionService`.

`CommissionService` obtains the persisted calculation base and sponsor chain, resolves active rule versions, creates unique immutable `CommissionTransaction` records, and calls `WalletService`. The commission engine is isolated from order orchestration so it can be retried without duplicate payments.

## Database connection and indexing

`connectToDatabase` is server-only and caches the Mongoose connection across hot reloads/functions. It uses bounded pool settings, connection/socket timeouts, retryable writes, and disables automatic index building in production. Index deployment is explicit through `npm run db:indexes`, which uses non-destructive `createIndexes()`.

## Operational safeguards

Zod validates mutation inputs; route handlers use bounded pagination and query escaping. Sensitive endpoints are rate limited. API errors return public messages and stable HTTP codes; internal error details are not returned. Audit records sanitize credentials and payment/bank data. Production browser source maps are disabled, Firebase Admin imports are server-only, and mock payment configuration fails closed in production.

See `DATABASE.md`, `MLM_LOGIC.md`, `API.md`, and `SECURITY.md` for the contract-level details.
