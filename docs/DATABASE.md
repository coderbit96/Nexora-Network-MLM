# Database design

MongoDB runs as a replica set because registration, stock, commissions, wallet posting, and withdrawal reservations need transactions. Mongoose schemas provide validation and indexes; critical invariants are also enforced by unique database indexes and service transactions.

## Collections and relationships

| Collection | Purpose and principal references |
| --- | --- |
| `users` | Application identity: Firebase UID (unique), email (unique), application account status, and active `roleIds`. Firebase proves identity; this collection and the referenced role records determine authorization. Member-specific data is linked one-to-one through `memberprofiles.userId`. |
| `memberprofiles` | One profile per user; unique `memberNumber` (`MLM000001` style) and referral code; encrypted bank/payment details remain separate from display fields. |
| `sponsorrelationships` | One permanent sponsor edge per sponsored member: `memberId → sponsorMemberId`; captures ancestry fields used for safe genealogy. |
| `placements` | Reserved placement representation, separate from sponsorship for future supported plans. Phase 1 does not use automatic placement. |
| `roles`, `permissions` | Configurable application authorization. `permissions` is the canonical catalog/audit registry; each role stores a validated array of its permission keys directly, avoiding a permission join at request time. Roles also carry a unique slug, coarse `baseRole`, and active/system flags. |
| `commissionrules` | Versioned direct/level rules with active/effective dates, calculation basis, rate/fixed amount, and level. |
| `commissiontransactions` | Immutable commission entitlement: beneficiary, source member/order, rule snapshot/reference, level, base, rate, amount, status. |
| `wallets` | One wallet per member: available, reserved/pending, lifetime earnings, and lifetime withdrawals. |
| `wallettransactions` | Immutable credit/debit ledger with positive amount, type, direction, reference, description, metadata, and balance snapshot. |
| `withdrawals` | Member request, reserved amount, transition history, reviewer/notes, payment reference, timestamps, and idempotency key. |
| `categories`, `products` | Commerce catalogue. Product has unique slug/SKU, integer price snapshots inputs, stock, PV/BV, images, and commission eligibility. |
| `orders` | Order header with member, payment/order/commission states, idempotency key, and embedded immutable `items` snapshots. |
| `payments` | Provider-neutral payment attempt, status, provider transaction/event identities, verified settlement metadata, and idempotency constraints. |
| `notifications` | User-owned messages with read state, type, target data, and timestamp. |
| `auditlogs` | Append-only, sanitized security and administrative activity: actor, target, action, safe before/after summary, context. |
| `settings` | Validated business settings only; never Firebase keys, payment secrets, or other environment credentials. |

Order items are embedded because an item belongs to one order and must preserve a purchase-time snapshot even after a product changes. Financial/commission records are separate to provide immutable, independently queryable history.

## Important indexes

- `users.firebaseUid`, `users.email`: unique; `users.roleIds` for permission resolution.
- `roles.slug`, `roles.name`: unique; `roles(baseRole, isActive)` supports assignable-role/staff queries and `roles.permissions` supports authorization/audit analysis. The `SUPER_ADMIN` system role stores no permissions because policy grants it implicit unrestricted access.
- `memberprofiles.userId`, `memberprofiles.memberNumber`, `memberprofiles.referralCode`: unique.
- `sponsorrelationships.memberId`: unique; sponsor/member and ancestor-oriented indexes for direct referrals and bounded genealogy traversal.
- `wallets.memberId`: unique. `wallettransactions` indexes member/time and reference identity; immutable model guards block update/delete operations.
- `commissiontransactions`: unique entitlement identity derived from source order, beneficiary, type, and level; additional beneficiary/source-order indexes.
- `withdrawals`: member/time/status and member-scoped idempotency key indexes.
- `products.slug`, `products.sku`: unique; active/category/search/sort indexes. `categories.slug` is unique.
- `orders`: unique member/idempotency key and order number; member/time, status/time, and payment-status/time indexes.
- `payments`: provider transaction ID and provider event idempotency indexes; order/status indexes.
- `notifications`: member/read/time index. `auditlogs`: action/target/time and actor/time indexes.
- `commissionrules`: type/active/effective-date/level query indexes; report/dashboard compound date indexes.

Exact declarations live in `src/models`; tests assert core uniqueness and reporting indexes.

## Index deployment

Run `npm run db:indexes` after a schema/index release. It calls `Model.createIndexes()` for registered models. This is additive and will not silently remove a production index. Obsolete or altered indexes require a reviewed, backed-up migration with an explicit maintenance window.

### Role permission migration

The RBAC key-based role release replaces legacy `roles.permissionIds` references with a validated `roles.permissions` string array. Before deploying code that depends on it, take a database backup and run `npm run db:roles:migrate`, then `npm run db:indexes`, and finally `npm run db:rbac`. The migration preserves valid legacy grants, gives active status to existing roles unless explicitly inactive, removes persisted grants from `SUPER_ADMIN`, and retains the canonical `permissions` documents for catalog display and migration traceability.

Do not depend on `autoIndex` in production: the application disables it there to prevent deployment latency and unreviewed DDL. Ensure the MongoDB database user can create indexes only for the controlled deployment job, or run the command through your migration pipeline.

## Data retention and privacy

Do not store plaintext banking data, credentials, ID tokens, webhook signatures, or secret keys in normal documents. Preserve financial/audit history according to legal and business retention policy. Before deletion/anonymization requests, assess whether immutable financial records must be retained and remove only personal display data using a controlled policy.
