# BPoint Gift Store Backend

This project adds a backend layer for the BPoint Gift Store storefront. Customer account credentials, sessions, and profile details are stored through Prisma; the storefront keeps a small public profile cache in browser storage. Other storefront features still use a mix of server APIs and browser storage.

## Stack

- Node.js + Express
- Prisma-backed relational persistence for accounts, catalog, orders, and payments
- bcryptjs for password hashing
- Paystack-compatible transaction initialization and verification hooks
- Node.js test runner for backend validation

## Local development

1. Install dependencies:
   npm install
2. Copy `.env.example` to `.env` and update values.
3. Start the app:
   npm start
4. Open the storefront at:
   http://localhost:3001/

## API overview

- `GET /api/health` — server status
- `GET /api/products` — list catalog
- `GET /api/products/:id` — product by id
- `POST /api/orders` — create a validated order
- `GET /api/payment-settings` — public payment methods and enabled transfer details
- `POST /api/customer/register` — create a database-backed customer account
- `POST /api/customer/login` — customer login
- `GET /api/customer/session` — current customer session
- `PUT /api/customer/profile` — update database-backed customer profile
- `POST /api/customer/logout` — end customer session
- `GET /api/orders/:id?token=...` — secure customer order lookup
- `POST /api/admin/login` — admin login
- `GET /api/admin/orders` — admin order list (requires admin bearer token)
- `GET /api/admin/payment-settings` and `PUT /api/admin/payment-settings` — manage transfer account details
- `POST /api/admin/orders/:id/confirm-transfer` — confirm a received bank transfer
- `POST /api/payments/initiate` — initialize Paystack transaction
- `POST /api/payments/verify` — verify a transaction reference
- `POST /api/payments/webhook` — Paystack webhook endpoint

## Admin setup

Admin access uses the database configured for the application and an HttpOnly session cookie. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the hosting environment (and in `.env` for local development). Use a unique password with at least 8 characters. The configured admin account is provisioned in the configured database on first setup; there is no browser-stored or demo login.

The application uses Neon PostgreSQL through Prisma. Set `DATABASE_URL` to the direct connection string and preferably `DATABASE_URL_POOLED` to the pooled connection string in the hosting environment. Runtime requests use `DATABASE_URL_POOLED` when available and fall back to `DATABASE_URL` (or `DATABASE_URL_UNPOOLED`) for Vercel setups that expose only those standard variable names. Prisma schema operations and seed scripts use the direct `DATABASE_URL`. Do not commit real credentials.

### Vercel deployment

The project includes a Vercel Node.js function configuration in `vercel.json`. Connect the project repository in the Vercel dashboard, set the project root to this directory, and use Node.js 24 (the supported version range is declared in `package.json`). Vercel installs the dependencies and generates the Prisma client during installation; the API and storefront are served by `server.js`.

Add these environment variables in the Vercel project settings for each environment you use (Production, Preview, and Development as appropriate):

- `DATABASE_URL` — Neon direct/unpooled PostgreSQL URL, used for schema changes and seed tasks.
- `DATABASE_URL_POOLED` — recommended Neon pooled PostgreSQL URL (hostname contains `-pooler`), used by the app at runtime when present. The app can use `DATABASE_URL` if this variable is not present.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` — use a unique account and a password of at least 8 characters.
- `PUBLIC_APP_URL` — the HTTPS origin used for payment callbacks. Set this to the canonical production domain for Production; use the relevant deployment origin when testing Preview payments.
- `CORS_ORIGIN` — the trusted storefront origin, matching `PUBLIC_APP_URL` with no trailing slash. Add additional origins only when needed, separated by commas.
- `PAYSTACK_SECRET_KEY` and `PAYSTACK_MODE` — matching test credentials for Preview/testing, and matching live credentials only when ready for real payments.

Do not put secret values in Git, source files, chat, or build output. Add them through Vercel's Environment Variables settings and redeploy after changing them. Test payments before enabling live Paystack credentials.

The application schema is PostgreSQL. Use the direct URL for schema setup and the pooled URL for web requests. Keep both database URLs in Vercel's encrypted Environment Variables; never place them in source files or build logs.

To use the same Vercel database locally, authenticate with Vercel, link this directory to the correct Vercel project using `vercel link`, and run `vercel env pull .env.local --environment production`. Local startup loads `.env.local` before `.env`, so the pulled project values take precedence. Both files are Git-ignored. Check that the selected Vercel project and environment point to the branch containing the seeded products before applying any schema changes.

After connecting the repository and setting variables, deploy a Preview first. Verify the HTTPS storefront and `/api/health`; the health endpoint checks database connectivity. Confirm the production domain and Paystack webhook URL before promoting a deployment or accepting live payments.

### Bank transfer checkout

Bank transfers are disabled until an admin enters the receiving bank, account name, and account number under **Admin → Payment Settings** and enables the option. Checkout collects only the recipient's name, phone, and delivery address, and uses bank transfer; it does not ask for an email address. Transfer orders stay pending until an admin verifies receipt and selects **Confirm received** on the Orders page. The account details are snapshotted with each order, so subsequent settings edits do not change instructions already issued to customers.

Before deploying this feature, back up the database or create a Neon branch. After reviewing the change, run `npm run db:push` against the intended database from a trusted environment to create `PaymentSettings` and add recipient snapshots and optional account association to orders. Do not put database credentials in Git, chat, source files, or Vercel build logs.

### Database setup and safe seed

The Neon database URLs were shared in chat and must be rotated before use. After rotation, add the direct URL as `DATABASE_URL` and the `-pooler` URL as `DATABASE_URL_POOLED` in Vercel and in a local `.env` used for setup. Do not commit either value.

Review or create a Neon branch/backup before applying schema changes. From a trusted local environment with the rotated direct URL configured, run `npm run db:push` to synchronize `prisma/schema.prisma`, then `npm run db:seed` to idempotently seed the four configured delivery zones. The seed does not create sample products or change customer/order data. Do not run these commands as part of the Vercel build or startup.
## Database schemas and migration utilities

`prisma/schema.prisma` is the canonical PostgreSQL schema for the application. `DATABASE_URL` is the direct connection; `DATABASE_URL_POOLED` is the pooled runtime connection. `npm run db:generate` generates the app client from this schema. `prisma/schema.mysql.prisma` and `prisma/schema.postgres.prisma` are isolated clients retained only for the historical Neon-to-Namecheap migration and verification tooling; neither is used by the app.

The migration tools use `NEON_SOURCE_DATABASE_URL` (read-only source) and `NAMECHEAP_DB_HOST`, `NAMECHEAP_DB_PORT`, `NAMECHEAP_DB_NAME`, `NAMECHEAP_DB_USER`, and `NAMECHEAP_DB_PASSWORD` (target). These settings are separate from the app's `DATABASE_URL`. `npm install` generates the PostgreSQL app client through the portable `postinstall` script. Migration clients are not part of production app installation; generate them when needed with `npm run db:migration:clients:generate`, `npm run db:mysql:generate`, or `npm run db:postgres:source:generate`.

The copy utility is for a fresh, empty target only. It reads Neon rows in a read-only repeatable-read transaction, checks relations and MySQL field and unique-value compatibility, then copies in dependency order. An interrupted copy can leave partial data; prepare a fresh empty target before retrying. `npm run db:mysql:verify` compares counts, IDs, row values, unique values, and relationships between Neon and MySQL. MariaDB JSON fields are handled through Prisma's generated client.

`npm run db:mysql:check` checks a fresh target without creating tables. `npm run db:mysql:push` requires `CJGIFTS_SCHEMA_CREATE_CONFIRM=CREATE_SCHEMA_ON_VERIFIED_EMPTY_NAMECHEAP_DATABASE` and checks that target before creating the schema. `npm run db:mysql:migrate` requires `CJGIFTS_MIGRATION_CONFIRM=COPY_NEON_READ_ONLY_TO_EMPTY_NAMECHEAP_TARGET`. Keep the migration source URL and target credentials out of Git.

## Paystack configuration

Set the following variables in production:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_MODE` (`test` or `live`, matching the key prefix)
- `PUBLIC_APP_URL` (the site origin; use the HTTPS production URL)

Keep `PAYSTACK_SECRET_KEY` only in server environment variables. Test keys can exercise hosted checkout and webhook confirmation in any environment; test-paid orders are labeled as tests and cannot be fulfilled or included in revenue. Switch both the key and `PAYSTACK_MODE` to live before accepting real orders. Payment initialization and verification fail closed if credentials or the public HTTPS site URL are missing. Orders are confirmed only after Paystack verifies the exact NGN amount and currency. Configure the Paystack webhook in the dashboard to point at:

`https://your-domain.com/api/payments/webhook`

## Testing

Run:

npm test

This includes validation tests for totals, cart rules, and duplicate payment handling.

## Notes

- Admin identity, customer accounts, sessions, catalog, orders, and payments use Neon PostgreSQL through Prisma.
- Cart contents and the small public profile cache use browser storage.
- Shipping and delivery zones are intentionally configurable and honest: unsupported destinations are blocked rather than guessed.

## Performance notes

- The storefront uses system fonts only (no Google Fonts), no page-transition overlay and no looping animations.
- Static assets are cached for 7 days (HTML always revalidates). CSS/JS links carry `?v=3` — bump it when you change those files.
- Optional: run `npm i compression` to enable response compression automatically.
