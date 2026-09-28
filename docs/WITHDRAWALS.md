# Withdrawal workflow

## Reservation strategy

The wallet's `availableMinor` balance is spendable. `heldMinor` is reserved and never spendable. On a withdrawal request, `WithdrawalService` atomically creates the request and an immutable `WITHDRAWAL_RESERVATION` ledger entry, decreasing available balance and increasing held balance by the same integer-minor-unit amount.

No money is paid at approval or processing. On rejection or member cancellation, an immutable `WITHDRAWAL_RELEASE` entry transfers the exact amount from held back to available. On completion, an immutable `WITHDRAWAL` entry consumes the held amount, increments lifetime withdrawal/debit totals, and stores the manual payment reference. Thus the same available funds cannot support two withdrawals.

MongoDB transactions must run on a replica set. Transaction retries serialize competing wallet writes, while the member-scoped withdrawal idempotency index protects duplicate submissions.

## State transitions

```text
PENDING    -> APPROVED | REJECTED | CANCELLED
APPROVED   -> PROCESSING | REJECTED
PROCESSING -> COMPLETED | REJECTED
COMPLETED, REJECTED, CANCELLED -> terminal
```

Only members may cancel their own pending request. Administrators with `withdrawals.manage` make every other transition. Rejection requires a reason; completion requires a payment reference. Each administrator action appends timeline data, creates a member notification, and writes an immutable audit log.

## Limits

The default minimum is `10000` INR minor units (₹100.00). Override it with `Setting` records `withdrawal.minimum_minor` and optional `withdrawal.maximum_minor`, stored as non-negative integer strings or safe integers. The maximum must not be lower than the minimum.
