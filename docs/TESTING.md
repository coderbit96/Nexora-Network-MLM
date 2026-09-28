# Testing

## Commands

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:integration
npm run build
```

`npm test` uses Node's test runner through `tsx` and exercises unit/service/schema/security behavior without using production data. `npm run test:integration` contains the database-backed end-to-end scenario and intentionally skips unless both variables below are set:

```text
MLM_TEST_MONGODB_URI=mongodb://…/mlm_test?replicaSet=…
MLM_TEST_MONGODB_DB_NAME=mlm_test
```

The test database must be disposable, isolated from development/production, and a MongoDB replica set. The test runner can create and delete test records; never target a shared or production database.

## Coverage priorities

- Authentication: missing tokens, account status, role/permission boundaries, Firebase Admin configuration isolation, and password policy.
- Referrals/genealogy: valid/inactive/invalid sponsor resolution, no-referral path, self/cycle rejection, direct referrals, bounded ancestry/descendants.
- Commission: direct and multi-level plans, missing/inactive rules, inactive uplines, zero/non-eligible business, precise integer rounding, duplicate and concurrent processing.
- Wallet: immutable ledger, credits/debits, manual adjustments, insufficient balance, exact summary updates, concurrent posting.
- Withdrawals: reservation, release/settlement, valid/invalid state transitions, idempotency, and concurrent requests.
- Commerce/payment: server-side snapshots, price tampering, inactive/invalid stock, checkout idempotency, payment/webhook replay and settlement ordering.
- Security: safe errors, rate-limit status, report/query bounds, image URL validation, notification scoping, audit sanitization, IDOR/permission boundary helpers.

## Database E2E scenario

The integration test asserts database state rather than only user-facing messages:

1. Configure commission rules.
2. Establish member A, then register B with A's referral and C with B's referral.
3. Create C's eligible order using server-authoritative product snapshots.
4. Process the authoritative payment/business event.
5. Assert direct/level beneficiaries, commission records, and wallet ledger entries.
6. Request a withdrawal, then approve, process, and complete it.
7. Assert reservation, settlement, and historical consistency.

## Manual release smoke test

Before deployment approval, test public, auth, member, and authorized-admin routes at 375px, 768px, and 1440px. Include keyboard navigation, visible loading/error/empty states, destructive-action confirmation, unread notifications, mobile table overflow behavior, and 404/error recovery. Verify a real provider webhook in a staging environment before enabling payment in production.

## CI recommendation

Run TypeScript, lint, unit tests, integration tests against an ephemeral replica set, production preflight, and production build on every protected branch. Preserve test/audit artifacts, fail deployment when any quality gate fails, and run dependency/security scanning separately in CI.
