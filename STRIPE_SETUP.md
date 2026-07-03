# P31 Marketplace — Stripe Payments Setup

Vendors connect their own Stripe account (Stripe Connect **Express**) from the
dashboard, buyers pay by card via Stripe Checkout, and payouts land directly in
the vendor's bank account. Orders are recorded automatically and shown in the
vendor's **Sales** tab.

## How money flows

1. Vendor clicks **Connect with Stripe** (Dashboard → Storefront) and completes
   Stripe's hosted onboarding (identity + bank account).
2. A buyer clicks a product on the vendor's storefront → Stripe Checkout opens.
3. The charge is created on the platform account with a
   `transfer_data.destination` pointing at the vendor's connected account, so
   funds (minus the optional platform fee) route to the vendor automatically.
4. The `checkout.session.completed` webhook records the order in Supabase; the
   vendor sees it in **Dashboard → Sales** and marks it fulfilled.

## One-time setup

### 1. Run the database migration

In the Supabase SQL Editor, run [storefront_v13_stripe_connect.sql](storefront_v13_stripe_connect.sql).
It adds Stripe columns to `curator_data` and creates the `orders` table with RLS.

### 2. Enable Stripe Connect

In the [Stripe Dashboard](https://dashboard.stripe.com/):
- Go to **Connect → Get started** and enable Connect with **Express** accounts.
- (Test mode works the same way — use test keys first.)

### 3. Set environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (or `sk_test_...`) from Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the webhook endpoint you create in step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key (server-only, never expose in the client) |
| `SUPABASE_URL` | Your Supabase project URL (same value as `VITE_SUPABASE_URL`) |
| `APP_URL` | Your production URL, e.g. `https://p31market.com` (used for Stripe redirect URLs) |
| `PLATFORM_FEE_PERCENT` | Optional. e.g. `5` keeps 5% of each sale for the platform. Defaults to `0`. |

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` should already be set for the frontend.

### 4. Create the webhook endpoint

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
- URL: `https://<your-domain>/api/stripe/webhook`
- Events to send:
  - `checkout.session.completed`
  - `account.updated`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

## API endpoints (Vercel serverless functions in `api/`)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/stripe/connect` | Vendor session | Create/reuse the vendor's Express account, return onboarding link |
| `POST /api/stripe/account-status` | Vendor session | Sync charges/payouts status; `{"action":"dashboard"}` returns an Express dashboard login link |
| `POST /api/stripe/checkout` | Public | Create a Checkout Session for a product (`{"productId": 123}`) |
| `POST /api/stripe/webhook` | Stripe signature | Records orders, syncs account status |

## Local development

`npm run dev` (Vite) serves only the frontend — the `/api` functions won't exist.
To run the full stack locally:

```bash
npm i -g vercel
vercel dev
```

and put the env vars above in `.env` (Vercel dev loads them). To receive
webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Testing the flow (test mode)

1. Use `sk_test_...` keys and a test-mode webhook.
2. As a vendor: Dashboard → Storefront → **Connect with Stripe** — Stripe's
   test onboarding lets you fill fake data (use `000-000-0000` / any test SSN
   prompts it offers).
3. Visit the storefront, click a product, pay with card `4242 4242 4242 4242`,
   any future expiry / any CVC.
4. Check Dashboard → **Sales** for the recorded order.
