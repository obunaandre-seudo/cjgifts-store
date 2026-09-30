# CJ Gifts Store Backend

This project adds a backend layer for the CJ Gifts storefront. Customer account credentials, sessions, and profile details are stored in PostgreSQL through Prisma; the storefront keeps a small public profile cache in browser storage. Other storefront features still use a mix of server APIs and browser storage.

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
- `POST /api/customer/register` — create a database-backed customer account
- `POST /api/customer/login` — customer login
- `GET /api/customer/session` — current customer session
- `PUT /api/customer/profile` — update database-backed customer profile
- `POST /api/customer/logout` — end customer session
- `GET /api/orders/:id?token=...` — secure customer order lookup
- `POST /api/admin/login` — admin login
- `GET /api/admin/orders` — admin order list (requires admin bearer token)
- `POST /api/payments/initiate` — initialize Paystack transaction
- `POST /api/payments/verify` — verify a transaction reference
- `POST /api/payments/webhook` — Paystack webhook endpoint

## Admin setup

Admin access uses the Neon database and an HttpOnly session cookie. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Vercel Project Settings → Environment Variables (and in `.env` for local development). Use a unique password with at least 12 characters. The configured admin account is provisioned in Neon on the first successful setup; there is no browser-stored or demo login.

Set `DATABASE_URL` in Vercel to the Neon connection string. The admin password is stored as a bcrypt hash, and session tokens are stored hashed in the database. Do not put real credentials in Git or share them in chat.

After configuring `DATABASE_URL`, apply the schema and create the sample catalog with:

```sh
npm run db:generate
npm run db:push
npm run db:seed
```

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

- Admin identity, sessions, and the public product API use Neon/PostgreSQL through Prisma.
- Other local storefront state such as customer accounts, cart contents, and orders still uses the JSON/browser storage implementation and is not yet cross-device persistent.
- Shipping and delivery zones are intentionally configurable and honest: unsupported destinations are blocked rather than guessed.
