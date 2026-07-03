# P31 Marketplace — Stripe Payments Setup (Supabase)

> ## ⏸️ Card payments are currently OFF (by design)
>
> The site ships with `VITE_ENABLE_CARD_PAYMENTS=false` in `.env`. In this
> mode there is **nothing to configure and no keys or banking info anywhere**:
> curators build their full store and get paid through their own pasted links
> (their Stripe Payment Link, CashApp, Venmo). All card-payment UI is hidden.
>
> When you're ready for built-in card checkout, complete the steps below, set
> `VITE_ENABLE_CARD_PAYMENTS=true`, and redeploy.
>
> **Note for the site owner:** the two Stripe secrets below belong in *your*
> Supabase dashboard and come from *your* Stripe dashboard. You can enter them
> yourself — no developer or third party ever needs to see or hold your keys.

Vendors connect their own Stripe account (Stripe Connect **Express**) from the
dashboard, buyers pay by card via Stripe Checkout, and payouts land directly in
each vendor's own bank account. The payment backend runs entirely on **Supabase
Edge Functions** — no Vercel or separate server required. Orders are recorded
automatically and shown in the vendor's **Sales** tab.

## The important part: you never enter vendors anywhere

You do a **one-time** setup with **your own** platform Stripe account (below).
After that, each vendor connects their own account by clicking **Connect with
Stripe** in their dashboard — you never touch their details. Every vendor gets
their own checkout and their own payouts automatically.

## How money flows

1. Vendor clicks **Connect with Stripe** (Dashboard → Storefront) and completes
   Stripe's hosted onboarding (identity + bank account).
2. A buyer clicks a product on the storefront → Stripe Checkout opens.
3. The charge is a destination charge to the vendor's connected account, so
   funds (minus the optional platform fee) route to the vendor automatically.
4. The `checkout.session.completed` webhook records the order in Supabase; the
   vendor sees it in **Dashboard → Sales** and marks it fulfilled.

---

## One-time setup

### 1. Run the database migration

In the Supabase SQL Editor, run [storefront_v13_stripe_connect.sql](storefront_v13_stripe_connect.sql).
It adds Stripe columns to `curator_data` and creates the `orders` table with RLS.

### 2. Enable Stripe Connect

In the [Stripe Dashboard](https://dashboard.stripe.com/) → **Connect → Get
started**, enable Connect with **Express** accounts. (Start in test mode.)

### 3. Add your secrets to Supabase

Only two secrets are required — Supabase injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` into Edge Functions automatically.

**Via the dashboard:** Project → **Edge Functions → Secrets** (or Project
Settings → Edge Functions), add:

| Secret | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (then `sk_live_...`) from Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the webhook you create in step 5 |
| `APP_URL` | Your site URL, e.g. `https://p31market.com` (used for Stripe redirect links) |
| `PLATFORM_FEE_PERCENT` | Optional. e.g. `5` keeps 5% of each sale for the platform. Defaults to `0`. |

**Via the CLI** (equivalent):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... APP_URL=https://p31market.com
```

### 4. Deploy the Edge Functions

**Via the CLI** (recommended):

```bash
supabase link --project-ref xsnhxjttdizljaawpumz
supabase functions deploy stripe-connect
supabase functions deploy stripe-account-status
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook   # config.toml sets verify_jwt = false for this one
```

**Via the dashboard:** Project → **Edge Functions → Deploy a new function**,
create one per folder in `supabase/functions/`, and paste in each `index.ts`.
For **stripe-webhook**, turn **Verify JWT** OFF (Stripe can't send a Supabase
token). The other three keep Verify JWT on.

### 5. Create the webhook endpoint

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
- URL: `https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed` and `account.updated`
- Copy the signing secret into the `STRIPE_WEBHOOK_SECRET` secret (step 3) and
  redeploy `stripe-webhook`.

---

## Edge Functions (in `supabase/functions/`)

| Function | Caller | Purpose |
|---|---|---|
| `stripe-connect` | Vendor | Create/reuse the vendor's Express account, return onboarding link |
| `stripe-account-status` | Vendor | Sync charges/payouts status; `{ "action": "dashboard" }` returns a Stripe dashboard login link |
| `stripe-checkout` | Public | Create a Checkout Session for a product (`{ "productId": 123 }`) |
| `stripe-webhook` | Stripe | Records orders, syncs account status (Verify JWT **off**) |

The frontend calls these through `supabase.functions.invoke()` (see
[src/lib/payments.js](src/lib/payments.js)); the auth token is attached
automatically, so no keys ever live in the browser.

## Testing (test mode)

1. Use `sk_test_...` and a test-mode webhook.
2. As a vendor: Dashboard → Storefront → **Connect with Stripe** and complete
   Stripe's test onboarding.
3. On the storefront, click a product and pay with test card
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
4. Check Dashboard → **Sales** for the recorded order.

## Local development

`npm run dev` (Vite) serves only the frontend. To run the functions locally:

```bash
supabase functions serve --env-file ./supabase/.env.local
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```
