# MLM logic

## Supported plan scope

Phase 1 supports only:

- Direct referral commission: the sponsor of the source member can receive a configured rule.
- Configurable level commission: level 1 is the immediate sponsor, level 2 its sponsor, and so on.
- Commission basis: eligible order subtotal or persisted PV/BV, based on the active rule.

Binary matching, matrix compensation, leadership pools, placement plans, and multiple compensation plans are not implemented.

## Referral integrity

Registration resolves a submitted referral code server-side. The code must map to an active, eligible sponsor. The service creates the member profile, permanent sponsor relationship, wallet, and welcome notification in a safe workflow. It rejects self-referral, invalid/inactive sponsors, duplicate profiles/wallets, and any relationship which would introduce a circular ancestry.

Genealogy queries use direct sponsor edges and bounded depth/pagination. Member access is restricted to permitted network information; admins may inspect other members only with server-side authorization.

## Commission processing

```
Verified eligible payment/business event
  → persisted order snapshot and commission eligibility
  → CommissionService calculates trusted base
  → resolves bounded upline chain
  → loads active/effective commission rules
  → creates unique CommissionTransaction entitlement(s)
  → WalletService posts immutable ledger credit(s)
  → wallet summary and notifications update
```

The client cannot submit commission percentages, bases, beneficiaries, or payment success as a source of truth. Order snapshots preserve product price, PV/BV, and eligibility at checkout, so later catalogue edits cannot alter historic calculations.

### Rules

`CommissionRule` stores type (`DIRECT` or `LEVEL`), optional level, calculation basis, percentage or fixed rate, active flag, effective dates, and a stable rule reference/version. Direct rules target the immediate sponsor relationship. Level rules preserve their original level position: an inactive upline is skipped rather than causing a deeper member to become level 1.

### Idempotency and auditability

Each commission entitlement has a unique source/reference identity combining the source order, beneficiary, type, and applicable level. Reprocessing or concurrent processing of the same order therefore collides safely at the database boundary. A created commission records beneficiary, source member/order, type/level, calculation base, rate, amount, rule reference, status, and timestamp. The corresponding wallet transaction carries the commission reference.

Commissions are immutable history. Corrections are represented with a clearly referenced reversal/adjustment ledger operation, never by editing the original commission amount. Rule changes affect future eligible events and do not rewrite historical records.

## Money and rounding

All monetary values use integer minor units. Percentage calculations use integer arithmetic and explicitly round down to the smallest currency unit. Negative/zero financial postings are rejected. This avoids floating-point rounding errors in totals, ledger balances, commissions, and withdrawals.

## Preconditions and non-payable cases

No commission is created for zero eligible value, inactive/out-of-effect rules, absent configured levels, non-eligible product lines, missing uplines, inactive uplines (where the policy excludes them), unverified payment/business events, or duplicate source processing. The payment/order workflow is responsible for invoking the engine only after an authoritative event; the engine remains defensively idempotent.
