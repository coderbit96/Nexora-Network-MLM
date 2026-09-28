# Nexora Network

Nexora Network is a Next.js 16, Firebase Authentication, MongoDB/Mongoose application for governed direct-referral and level-commission operations. Financial values are integer minor units; ledger and commission history are immutable.

## Requirements

- Node.js 20 LTS or later and npm.
- MongoDB 7+ configured as a replica set (Atlas is suitable). Transactions are required for financial workflows.
- A Firebase project with Email/Password authentication enabled.
- A separate, non-production MongoDB database for integration tests.

## Installation

```bash
npm install
Copy-Item .env.example .env
```

Populate `.env` with local/development values. It is ignored by Git. Never paste production credentials into source files, issues, logs, or client-side variables.

## Environment variables

`.env.example` documents local development. `.env.production.example` documents deployment values.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public application origin; used for links, metadata, robots, and sitemap. |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Replica-set MongoDB connection and database. |
| `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE` | Bounded Mongoose connection-pool settings. |
| `NEXT_PUBLIC_IMAGE_REMOTE_HOSTS` | Comma-separated HTTPS image hosts allowed by Next Image. |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web configuration (public identifiers, never admin keys). |
| `FIREBASE_ADMIN_*` | Server-only Firebase Admin credentials. |
| `PAYMENT_*` | Server-only payment provider API/webhook settings. Mock payments are rejected in production. |
| `FIELD_ENCRYPTION_KEY` | Server-only base64 32-byte key for sensitive payment/bank fields. |
| `INITIAL_ADMIN_*` | Development seed input only; prohibited by production preflight. |

Do not set a secret with a `NEXT_PUBLIC_` prefix. Production deployment values belong in the host's encrypted secrets manager, not a committed file.

## Firebase setup

1. Create a Firebase project and enable Email/Password under **Authentication**.
2. Register a web application and copy its web configuration to `NEXT_PUBLIC_FIREBASE_*`.
3. Create a Firebase Admin service account. Store only its project ID, client email, and escaped private key in server-only deployment secrets.
4. Configure the authorized domain(s), password-reset continue URL, and email verification action URL to the production application URL.

Firebase proves identity only. The API also loads the MongoDB application user, checks account status, and resolves server-side roles/permissions for every protected operation.

## MongoDB setup and indexes

Use an Atlas cluster or self-managed replica set. Restrict network access, use a least-privilege database user, enable backups, and enforce TLS.

After every deployment that changes schemas, run this once against the target database:

```bash
npm run db:indexes
npm run db:rbac
```

`db:indexes` uses Mongoose `createIndexes()` only: it can add declared indexes but never drops unknown production indexes. Review/drop obsolete indexes through a planned database migration, not application startup.

## Development and seeds

```bash
npm run dev
npm run db:indexes
npm run db:rbac
npm run seed:admin
```

Seed scripts are manual development tools; they are not called by application startup, build, or deployment. Use synthetic data only and do not run them against production.

## Testing

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:integration
```

The integration/E2E test is intentionally skipped until both `MLM_TEST_MONGODB_URI` and `MLM_TEST_MONGODB_DB_NAME` point to an isolated disposable replica-set database. See `docs/TESTING.md`.

## Production build and deployment

```bash
npm run preflight:production
npm run db:indexes
npm run db:rbac
npm run build
npm run start
```

`preflight:production` fails if the environment is not production, has a local application URL, retains seed credentials, enables a mock payment provider, or lacks required server configuration. A production deployment still requires a real payment adapter; no mock provider is a production payment solution.

For an audit build while `next dev` is running, set `NEXT_DIST_DIR` to an isolated output directory before building. Use the same value for `next start` if serving that output.

Before release, run the checklist in `docs/SECURITY.md` and the release checklist below.

## Release checklist

- [ ] `npm run preflight:production`, TypeScript, lint, unit tests, integration/E2E tests, and `npm run build` pass.
- [ ] Production is backed up, TLS protected, replica-set enabled, and indexes/RBAC initialized.
- [ ] Firebase domains, reset/verification URLs, and Admin credentials are configured as server-only secrets.
- [ ] Mock payment is disabled; a real payment provider adapter and signed webhook verification are configured and tested.
- [ ] Production seed variables and development data are absent.
- [ ] `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_IMAGE_REMOTE_HOSTS`, robots, sitemap, and public metadata reflect the final domain.
- [ ] Error/404 pages and the responsive public/member/admin journeys are manually smoke-tested at 375px, 768px, and 1440px.
- [ ] Monitoring, backups, log retention, incident contacts, and credential-rotation procedures are operational.

Further design and operating details are in `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/MLM_LOGIC.md`, `docs/SECURITY.md`, and `docs/TESTING.md`.
