# CJ Gifts Store Backend

This project adds a real backend layer for the CJ Gifts storefront. The frontend remains largely in the original static HTML/CSS/JS structure, while the backend provides persistent product, order, checkout, Paystack, and admin APIs.

## Stack

- Node.js + Express
- JSON file persistence for local development
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
- `GET /api/orders/:id?token=...` — secure customer order lookup
- `POST /api/admin/login` — admin login
- `GET /api/admin/orders` — admin order list (requires admin bearer token)
- `POST /api/payments/initiate` — initialize Paystack transaction
- `POST /api/payments/verify` — verify a transaction reference
- `POST /api/payments/webhook` — Paystack webhook endpoint

## Admin setup

Default local admin credentials are seeded with the environment values in `.env`.

For a local default:

- username: `admin`
- password: `admin123`

Change them before production use and never commit real credentials.

## Paystack configuration

Set the following variables in production:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `USE_TEST_PAYSTACK=true` in local testing, then switch to `false` only after confirming a production-ready account configuration.

The app is structured to support test-mode checkout without charging real cards. Paystack webhooks must be configured in the Paystack dashboard to point at:

`https://your-domain.com/api/payments/webhook`

## Testing

Run:

npm test

This includes validation tests for totals, cart rules, and duplicate payment handling.

## Notes

- The local development implementation uses a JSON store instead of PostgreSQL to keep setup lightweight.
- For production, move this to a managed PostgreSQL + Prisma setup following the same API contracts.
- Shipping and delivery zones are intentionally configurable and honest: unsupported destinations are blocked rather than guessed.
