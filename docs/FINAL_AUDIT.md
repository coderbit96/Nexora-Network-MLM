# Final hostile QA audit

Date: 2026-09-29

This was an adversarial source, schema, route, and automated-test review. It is not a statement that the system is secure or production-ready in every deployment configuration.

## Scope and method

- Reviewed all App Router routes, authorization helpers, Mongoose schemas/indexes, financial services, payment workflow, referral/genealogy services, interactive components, and test suites.
- Searched for unrestricted updates, client-owned financial values, unsafe regex construction, dead/placeholder interactions, unsafe HTML, and unbounded pagination/query patterns.
- Ran TypeScript, ESLint, unit tests, and the guarded database-integration command.
- Attempted live browser review. The supplied browser connector failed before navigation with `codex/sandbox-state-meta: missing field sandboxPolicy`; mobile visual behavior could therefore not be independently exercised in this environment.

## Findings

| ID | Severity | Finding | Result |
| --- | --- | --- | --- |
| F-01 | HIGH | Two concurrent payment-initiation requests could both reach `provider.createPayment()` before either wrote `providerTransactionId`. A real provider could therefore receive two intents/charges for one order. | **Fixed.** `PaymentService.createPayment()` now atomically claims one uninitialized payment before any provider call. Competing callers receive a conflict; an interrupted in-progress claim fails closed and requires reconciliation rather than risking a second provider charge. |
| F-02 | HIGH | A product marked `commissionEligible: false` zeroed PV/BV, but subtotal/total commission rules still used the full order amount. This could credit commissions for ineligible products. | **Fixed.** Order items now snapshot eligibility immutably and commission bases include only eligible lines; `ORDER_TOTAL` allocates the total proportionally to eligible subtotal. |
| F-03 | HIGH | A refund could mark a paid order refunded after its commissions had been credited, with no compensating wallet ledger reversal. | **Fixed fail-closed.** Refunds with approved commission records are rejected until a compensating, ledger-backed commission-reversal workflow exists. Existing credits are no longer silently left spendable. |
| F-04 | HIGH | Payment settlement accepted state changes based only on the incoming status. Out-of-order provider events could attempt to regress a completed/refunded payment. | **Fixed.** Explicit payment transition rules allow only `CREATED -> PENDING -> SUCCESS/FAILED` and `SUCCESS -> REFUNDED`; terminal regressions are conflicts. Duplicate successful events also safely retry pending commission processing. |
| F-05 | MEDIUM | Admin Staff search/filtering happened after pagination, producing misleading totals and empty pages while scanning the user collection. | **Fixed.** The query now uses resolved non-member role IDs and server-side escaped search before pagination. A supporting `User(roleIds, createdAt)` index was added. |
| F-06 | MEDIUM | The category API returned `productCount: 0` for every category, a false operational metric. | **Fixed.** It now uses one bounded aggregation and joins counts in memory, avoiding N+1 product counts. |
| F-07 | MEDIUM | Rate-limit exhaustion returned HTTP 400, causing clients and monitoring to treat throttling as invalid input. | **Fixed.** It now returns `429 RATE_LIMITED` with regression coverage. The limiter itself remains process-local; see remaining risks. |
| F-08 | MEDIUM | Password reset accepted any 12-character password while registration required uppercase, lowercase, and a number, weakening an established account through the reset path. | **Fixed.** Registration, reset UI, and future Firebase administrator creation use one shared strong-password policy. Existing accounts are not modified automatically. |
| F-09 | MEDIUM | Catalogue image URLs allowed HTTP, enabling mixed-content/privacy downgrade risks when displayed in member/admin pages. | **Fixed.** API validation and schema validation require HTTPS image URLs. |
| F-10 | MEDIUM | Reports/admin list paths use `skip` pagination. Limits cap interactive pages, but very deep permitted pages will still become slower as data grows. | Open. Cursor/keyset pagination is recommended before large-scale deployment. |
| F-11 | MEDIUM | Commission-rule management does not yet provide a complete audited CRUD workflow in the application. | Open functional gap. Do not use direct database edits for production compensation changes; implement a dedicated audited workflow in a scoped follow-up. |
| F-12 | MEDIUM | Only the development mock payment adapter is implemented. It is intentionally rejected in production, so a real provider adapter and provider-specific webhook tests are required for a production launch. | Open deployment requirement. This is correctly fail-closed, not a browser-confirmed payment flow. |
| F-13 | LOW | No Content Security Policy is configured. Existing defensive headers are useful but do not constrain every script/source origin. | Open. Add a tested nonce/hash CSP after final Firebase and payment-provider origins are known. |
| F-14 | LOW | Integration E2E tests are guarded and skipped without a dedicated MongoDB test replica set. | Open environment requirement. The suite refuses to run against a database name that does not end in `-test` or `_test`. |
| F-15 | MEDIUM | Orders created before F-02 do not contain the new immutable `commissionEligible` item snapshot. | Open migration requirement. Pending historical commissions fail closed rather than guessing eligibility from mutable catalogue data; reconcile those orders before production deployment. |
| F-16 | HIGH | MongoDB `int64` money fields read through Mongoose `lean()` were decoded as JavaScript numbers. Amounts above `Number.MAX_SAFE_INTEGER` could throw during bigint arithmetic or lose precision. | **Fixed.** The Mongo connection enables `useBigInt64`; the isolated database E2E suite now posts and verifies a value larger than `Number.MAX_SAFE_INTEGER`. Restart long-running development processes after deployment so their connection uses the new option. |
| F-17 | HIGH | Replaying a wallet idempotency key with altered financial data returned the original ledger entry as if the altered operation succeeded. | **Fixed.** Ledger replay now verifies the member, currency, amount, direction, type, and reference. A mismatched replay returns a conflict and leaves the balance unchanged. Withdrawal request replays now also verify amount/currency. |
| F-18 | HIGH | Calling RBAC bootstrap during registration re-added default permissions to existing system roles, silently undoing a deliberate permission revocation. | **Fixed.** Bootstrap inserts defaults only when a role is first created; existing role grants are never changed by member registration. |
| F-19 | HIGH | An administrator who could edit roles could construct a role containing grants they did not themselves possess, enabling privilege escalation. | **Fixed.** The role service and UI constrain non-super administrators to non-system STAFF roles and to permissions they already hold. SUPER_ADMIN remains the only role with unrestricted role-definition authority. |
| F-20 | MEDIUM | Commission recovery after payment settlement only accepted an order while its fulfillment status was exactly `PAID`. A legitimate later retry could miss a pending commission after the order moved to fulfillment. | **Fixed.** Paid, processing, shipped, and delivered orders are eligible; cancelled and refunded orders remain ineligible. |

## Additional review outcomes

- No direct member-to-member IDOR was found in orders, payments, notifications, wallets, payment details, withdrawals, or genealogy routes. Queries derive the member profile from the verified Firebase identity and scope ownership server-side.
- No client-submitted price, PV, BV, commission rate, balance, or withdrawal eligibility is trusted in checkout, commissions, wallet posting, or withdrawal services.
- Referral assignment validates active sponsors, self-reference, duplicate ancestry, and circular sponsor paths, with materialized upline paths and indexes.
- Wallet, commission, and audit history have immutable query middleware; wallet postings and reservations occur in MongoDB transactions using integer minor units (`bigint`).
- Provider webhook event IDs and provider transaction IDs are uniquely indexed. Webhook body sizes and provider identifiers are bounded before provider parsing.
- No `dangerouslySetInnerHTML` usage was found. Interactive controls inspected had handlers, disabled states, or intentional empty/error states; accessibility remains subject to the unavailable live-browser review.

## Regression coverage added in this audit

- Ineligible product lines cannot create order-value commissions.
- Order snapshots retain catalogue commission eligibility.
- Payment terminal-state transition regression is rejected.
- Long-but-weak passwords are rejected by the shared password policy.
- Insecure product image URLs are rejected.
- Rate-limit exhaustion maps to HTTP 429.
- Reusing a wallet idempotency key for changed financial data is rejected without changing balances.
- Large `int64` wallet amounts round-trip as exact bigint values through the database.
- Existing RBAC grants remain unchanged when a new member registration initializes system roles.

## Verification

Executed successfully after remediation:

```text
npx tsc --noEmit
npm run lint
npm test                 # 93 passing tests
npm run build
# Isolated disposable MongoDB database E2E: 1 passing test
```

The integration test was run against a fresh, randomly named database ending in `_test`, then dropped on completion. `npm run test:integration` remains intentionally skipped unless its dedicated test database environment variables are supplied. A successful build is not evidence of browser/mobile behavior.

## Required actions before launch

1. Rotate the Firebase service-account key, MongoDB user password, payment secret, and any administrative password that were previously pasted into chat, screenshots, shared files, or logs. In particular, replace any known weak administrator password immediately.
2. Configure a least-privilege MongoDB user, replica set, backups, Atlas/network allow-list, TLS, trusted proxy, central structured logging, and a shared Redis/gateway rate limiter.
3. Implement and test a real payment provider adapter, signed webhook verification, reconciliation, refund compensation/reversal policy, and provider outage handling.
4. Implement audited commission-rule management rather than using database updates.
5. Run `npm run db:indexes`, then the guarded integration suite against a disposable replica-set test database, and perform live 375px/768px/1440px plus keyboard/screen-reader testing.
