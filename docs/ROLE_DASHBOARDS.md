# Role dashboards

Each workspace is selected after Firebase sign-in using the active MongoDB role. Firebase identifies the user; MongoDB account status, role, and permissions decide what the user can open and what data is returned.

## Admin

`/admin` is the platform operations dashboard for `ADMIN` and the single `SUPER_ADMIN` owner. It uses server-side database aggregation and only exposes metric groups allowed by the role:

- Member growth and member activity: `members.view`
- Sales and orders: `dashboard.sales` / `orders.viewAll`
- Wallet, commissions, and withdrawals: `dashboard.finance`
- Audit activity: `audit.view`
- Operational panels link only to permitted admin modules.

`SUPER_ADMIN` has every valid catalog permission implicitly. An `ADMIN` receives only the permissions assigned to its database role.

## Staff

`/staff` is a permission-scoped operational inbox. It does not expose platform-wide financial totals. It displays only queues whose route and data are permitted:

- Pending member accounts: `members.view`
- Withdrawal approval/process/complete queues: `withdrawals.viewAll` plus the exact action permission
- Fulfilment queue: `orders.viewAll`
- Pending payment queue: `payments.view`
- Low-stock product queue: `products.view`

The assigned operations section links only to modules allowed by the staff role. Counts are calculated on the server only after the corresponding permission check.

## Member

`/member` is the personal MLM dashboard. Queries are always scoped to the authenticated member profile and show:

- Available wallet balance, earnings, pending withdrawals, and orders
- Direct referrals, team size, and referral URL
- Personal earnings, team-growth, and commission-breakdown charts
- Personal transactions, referrals, orders, and notifications

Members cannot use this dashboard to access another member's records. Every member API derives the member profile from the verified Firebase identity.
