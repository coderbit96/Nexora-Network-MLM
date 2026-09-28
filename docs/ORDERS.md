# Cart and order workflow

## Trust boundary

The persisted cart stores only product IDs and quantities. At checkout, `OrderService` ignores every browser price, sale price, PV, BV, stock, category, and commission value. It reloads active products and categories within a MongoDB transaction, selects the effective price, validates inventory, calculates integer-minor-unit totals, and embeds immutable item snapshots in the order.

The checkout idempotency key is unique per member. Repeated requests return the original order rather than consume inventory again.

## Stock and payment

Creating an order atomically decrements stock using quantity guards, creates a `PAYMENT_PENDING` order and separate `CREATED` payment record, then clears the cart. Cancelling an unpaid order restores its item stock and marks an unstarted or pending payment as failed.

Payment settlement is intentionally not exposed through browser APIs or the admin fulfillment screen. `PaymentService` accepts only provider verification or an authenticated provider webhook, records `SUCCESS`, transitions the order to `PAID`, timestamps payment, makes commission processing eligible, and then invokes `CommissionService` after the transaction commits. Browser redirects cannot settle an order. Administrative refunds call the configured provider adapter's optional `refundPayment()` capability; they do not mutate a successful payment record directly.

## State separation

- `Order.status`: fulfillment/order lifecycle (`PAYMENT_PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, terminal cancellation/refund).
- `Order.paymentStatus` and `Payment.status`: payment lifecycle.
- `Order.commissionStatus`: separate commission engine lifecycle.

The fulfillment transition map blocks skipping states. Administrative changes require `orders.manage` and write audit entries.
