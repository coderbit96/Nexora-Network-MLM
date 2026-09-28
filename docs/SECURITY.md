# Security

This document records implemented controls and remaining operational requirements. It is not a claim that the application is invulnerable.

## Implemented controls

### Authentication and authorization

- Firebase Admin verifies bearer ID tokens server-side. Missing, malformed, expired, and invalid tokens are rejected.
- The verified Firebase UID is mapped to a MongoDB application user; account status must be `ACTIVE` and the user must retain at least one active MongoDB role. `SUSPENDED`, `DISABLED`, and `PENDING` users cannot establish normal application sessions or access protected routes.
- Authorization uses a centralized catalog-backed `has`/`require` service for single, any-of, and all-of permission checks. Invalid runtime permission strings are denied, including for Super Admin; unauthenticated requests receive `401` and authenticated-but-denied requests receive `403` without internal authorization details.
- Public registration is strict-schema validated and rejects role, role-ID, permission, and status injection. It resolves only the active `MEMBER` system role inside the server transaction; Admin/Staff role assignment is reserved for trusted administrative provisioning workflows.
- Roles and permissions are resolved in MongoDB. Client-supplied roles are ignored. Super Admin bypass is server-side and explicit.
- Member resources are ownership-scoped; administrative routes also enforce permission checks, not only hidden navigation.

### Input and API protections

- Zod schemas validate/bound mutation and report inputs. MongoDB regex search values are escaped and object IDs are validated.
- Sensitive routes use rate limiting and return `429` when exceeded.
- Route handlers use safe API errors and do not return raw stack traces, Firebase errors, database errors, or payment-provider secrets.
- Security headers disable framing, content-type sniffing, unnecessary browser permissions, and relax referrer detail.

### Financial and payment integrity

- Amounts use integer minor units; positive amount constraints and state maps reject negative, zero, invalid, or skipped transitions.
- Wallet and commission history are immutable. Wallet changes flow through `WalletService` and use transactions/atomic conditions.
- Commission and payment/webhook records have idempotency identities; duplicate source events cannot create duplicate entitlements.
- Checkout reloads product price, stock, PV/BV, and eligibility server-side. Payment success from a browser redirect is not authoritative.
- Mock payment configuration is rejected when `NODE_ENV=production`.

### Secrets and observability

- `.env*` is ignored except `.env.example`; PEM files are ignored. Firebase Admin modules use `server-only`.
- Production browser source maps are explicitly disabled. API error logging uses safe metadata; audit sanitization removes credentials, tokens, and full bank data.
- Settings do not accept database-stored Firebase/payment secrets. Bank/payment fields use the server-only encryption key.

## Production operations

1. Rotate any credential ever pasted in chat, screenshots, source control, or an untrusted machine. Treat it as compromised.
2. Put all production secrets in the host/cloud secrets manager with least-privilege access and rotation ownership.
3. Run `npm run preflight:production` in CI/CD. It rejects local URLs, seed credentials, missing required configuration, and mock payments.
4. Use a TLS-only MongoDB replica set, restricted IP/network access, least-privilege database users, backups, and alerting.
5. Configure Firebase authorized domains and email action URLs. Restrict service-account permissions to required Firebase Admin operations.
6. Use a real, reviewed payment adapter with signature verification, provider-event idempotency, timeout/retry behavior, and production webhook secret rotation. The current mock adapter is development-only.
7. Send structured logs to a protected sink with access controls and retention; never log request authorization headers, payment payload secrets, Firebase private keys, or full banking data.
8. Independently test the final deployed hostname at mobile, tablet, and desktop widths and run a dependency/vulnerability scan in CI.

## Remaining risks and limitations

- The in-process rate limiter is suitable for a single instance but is not a distributed rate-limit store. Multi-instance production deployment should use a shared durable limiter (for example Redis or a gateway/WAF limit) and keep current route limits as defense in depth.
- Email/password security additionally depends on Firebase project configuration, domain authorization, and user password hygiene.
- Payment production readiness remains blocked until a real provider adapter is selected, configured, and verified with live/webhook test credentials.
- Integration/E2E financial tests require a separately provisioned disposable MongoDB replica-set database; they are skipped without it.
- Security headers are a baseline. A deployment-specific Content Security Policy and external image-domain review should be added after all production analytics, payment, and support origins are finalized.
- Regulatory obligations (KYC, AML, tax, withdrawal controls, data retention, direct-selling law) require jurisdiction-specific legal/compliance review outside this codebase.

See `FINAL_AUDIT.md` for the earlier hostile review findings and regression work.
