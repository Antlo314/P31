# Systems, Studios & Commerce — setup

The one-time steps to turn everything on. Do them **in order**: the new site
code expects the v19 database changes, so run the SQL right before you deploy.

Already done: `v16` (security lockdown), `v17` (market dates), `v18` (Systems
and studios).

## 1. Database (Supabase → SQL Editor)

1. Run `storefront_v19_commerce_events_growth.sql` (paste the whole file, then Run).
   It adds: the shopping bag and order flow, discount codes, inventory that
   updates itself, RSVPs with capacity and a waitlist, per-market "date
   announced" switches, newsletter unsubscribe, email campaigns, AI usage
   limits, and it hides curators' private emails from the public.
2. Run `tests/security_check.sql`. It signs in as a real curator, tries every
   attack from the October 2026 audit, then rolls everything back. **Every row
   should say `passed = true`.**

## 2. Systems logins (`/systems`)

Systems uses normal Supabase accounts named `<username>@systems.p31market.com`.
Access comes only from the `system_operators` table — never from the address.
Passwords are never stored in the site's code.

1. Supabase → **Authentication → Users → Add user** (tick **Auto Confirm User**):
   - `antlo314@systems.p31market.com`
   - `melanie@systems.p31market.com`
   Passwords must be **at least 8 characters**.
2. SQL Editor:
   ```sql
   SELECT public.add_system_operator('Antlo314', 'owner');
   SELECT public.add_system_operator('Melanie',  'member');  -- or 'owner'
   ```
3. Sign in at **p31market.com/systems** with the username (e.g. `Antlo314`).
   Anyone can change their own password in **Settings**; owners can also reset
   a teammate's.

## 3. Edge Functions and secrets

`supabase/config.toml` already sets how each function checks callers, so plain
deploys are enough:

```bash
supabase functions deploy order-request
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy ai-assist
supabase functions deploy send-campaign
supabase functions deploy systems-admin
supabase functions deploy social-search
supabase functions deploy dm-agent
```

Secrets (Supabase → Edge Functions → Secrets, or `supabase secrets set NAME=value`):

| Secret | What it turns on | Where to get it |
|---|---|---|
| `RESEND_API_KEY` | Order emails, campaigns, test sends | resend.com → API Keys (verify `p31market.com` under Domains first) |
| `EMAIL_FROM` | Sender name/address, e.g. `P31 Marketplace <hello@p31market.com>` | — |
| `ANTHROPIC_API_KEY` | "Write with AI" everywhere (captions, product copy, bios, outreach, campaigns) | console.anthropic.com → API Keys |
| `APIFY_TOKEN` | Growth search + comment fetching | apify.com → Settings → Integrations |
| `APP_URL` | Links inside emails (defaults to `https://p31market.com`) | — |
| `ZERNIO_API_KEY` | DM assistant: reads conversations and sends replies | zernio.com → API Keys (the key whose account has P31's Instagram + Facebook) |
| `ZERNIO_WEBHOOK_SECRET` | DM assistant: proves webhook calls come from Zernio | Any long random string; the same value goes on the Zernio webhook |
| `DM_AGENT_ENABLED` | DM assistant on/off switch (`true` = on) | — |
| `DM_AGENT_DRY_RUN` | `true` = write replies to the function logs only, send nothing | — |
| `DM_AGENT_ACCOUNT_IDS` | Comma-separated Zernio account ids the assistant answers for | Zernio account ids |
| `DM_AGENT_NOTIFY_EMAIL` | Who gets an email when a DM needs a person | — |

Everything degrades gracefully: without a secret, that button explains what's
missing instead of failing. Systems → Settings shows what's connected.

AI limits: operators 300 requests/day, curators 40/day (logged in `ai_usage`).

DM assistant (`dm-agent`): answers Instagram and Facebook DMs in P31's voice.
Her persona and everything she knows live in
`supabase/functions/dm-agent/persona.ts`; edit it and redeploy to change her.
Upcoming markets come live from `market_events`. A date only shows once it's
marked public. She hands off refunds, complaints, fees and press to the team,
and stays out of any conversation a person on the team has replied in for
24 hours. In Zernio, add a webhook to
`https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/dm-agent` for events
`message.received` and `message.sent`, using the same secret as
`ZERNIO_WEBHOOK_SECRET`.

## 4. Card payments (optional)

Order **requests** work with no setup: shoppers fill their bag, send the order,
and the curator confirms it and shares how to pay (Cash App, Zelle, etc. from
their dashboard). To also take cards through Stripe:

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets (and optionally
   `PLATFORM_FEE_PERCENT`).
2. In Vercel → Settings → Environment Variables add `VITE_ENABLE_CARD_PAYMENTS=true`,
   then redeploy. Curators who finish Stripe onboarding get a "Pay by card" button.

## 5. Deploy the site

Push to `main` (Vercel builds it). The build now also writes a page per route
with its own title and share card, plus `sitemap.xml`. Then, because the old
onboarding code was public, rotate it:

```sql
UPDATE onboarding_codes SET active = false;
INSERT INTO onboarding_codes (code) VALUES ('YOUR-NEW-CODE');
```

After deploying, submit `https://p31market.com/sitemap.xml` in
[Google Search Console](https://search.google.com/search-console).

## 6. Pro Edit (premium) — Iris bridge

Pro Edit requests land in `pro_edit_jobs`. On the LumenCommand PC:

1. Create `tools/.env.iris` (git-ignored) — see the top of `tools/iris_bridge.py`.
   It holds the **service role key**: keep it on that machine only.
2. Start Iris (`START-IRIS.bat`), then `python tools/iris_bridge.py`.
3. The bridge claims each job, downloads and joins the footage, and has Iris
   build an Auto Edit package in the requested look. Push it into Resolve,
   finish and render, then **Systems → Pro Edit → Upload finished edit**.

Give a curator premium:
```sql
UPDATE curator_data SET plan = 'premium' WHERE slug = 'their-shop';
```

## 7. Mentorship Academy & Content Studio

Role-based dashboards behind one sign-in at **p31market.com/portal**:

| Who | Where | What they get |
|---|---|---|
| Business mentorship students | `/academy/business` | Sessions & join links, action plans with checkable next steps, goals, lessons, PDF library, submit work for feedback, member line (messages), billing |
| Faith mentorship students | `/academy/faith` | Lessons, private prayer & reflection journal, daily KJV verse, sessions, library, messages, billing |
| Mentors | `/academy/<program>/teach` | Students & 1:1 sessions, action plans, feedback on submissions, intro-call inbox, private enrollment invites, curriculum & file uploads, announcements, group sessions |
| Content Studio (3 seats) | `/studio` | Zernio overview & 30-day insights, best times, content calendar (edit / reschedule / delete), composer with media upload, DMs & comments (read-only), Clip & Photo Studio → straight into a post |
| Admins (Systems) | `/systems/academy` | Plan prices, mentors, members & manual / complimentary enrollment, Studio seats, all intro calls |

**Pricing is never public.** The public pages (`/mentorship`, `/mentorship/business`, `/mentorship/faith`) end in an intro-call form. After the call, a mentor sends a private, single-use enrollment link (Mentor console → Intro calls → *Send enrollment invite*); only that link shows the plan and price. Business is $250/month and Faith $160/month (seeded); weekly, pay-as-you-go and 6-month plans stay hidden until priced in Systems → Academy.

### Turn it on — in this order
1. **Database:** run `storefront_v20_academy_and_studio.sql` in the SQL Editor.
2. **Mentors and Studio seats** (each person needs an account first — students get one from their enrollment link; mentors and Studio members tap “Create an account” at `/portal`):
   ```sql
   SELECT public.add_academy_mentor('melanie@example.com', 'business', 'Lead mentor');
   SELECT public.add_studio_member('teammate@example.com');   -- up to 3 seats
   ```
   (Or use Systems → Academy.)
3. **Functions:**
   ```bash
   supabase functions deploy studio-zernio
   supabase functions deploy academy-checkout
   supabase functions deploy academy-billing
   supabase functions deploy academy-webhook
   supabase functions deploy dm-agent          # Carla now knows about the mentorships (never prices)
   ```
4. **Stripe (card enrollment):**
   - `supabase secrets set STRIPE_SECRET_KEY=sk_live_... APP_URL=https://www.p31market.com`
   - Stripe → Developers → Webhooks → *Add endpoint* `https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/academy-webhook` with events `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, then `supabase secrets set ACADEMY_STRIPE_WEBHOOK_SECRET=whsec_...`
   - Stripe → Settings → Billing → Customer portal: turn it on (students use it to update cards or cancel).
5. **Deploy the site** (merge `feature/academy-studio` into `main`).

Until Stripe is connected, invite links explain that card payments aren’t ready and point to members@thep31collective.org, and admins can enroll people manually in Systems → Academy.

## What's where

| Feature | Who | Where |
|---|---|---|
| Landing page (2026) | Public | `/` |
| Marketplace search, filters, favorites | Public | `/shop`, `/favorites` |
| Shopping bag (multi-shop), discount codes, order requests | Public | Bag button in the top bar |
| Market dates + RSVP / waitlist + calendar file | Public | `/calendar` |
| Install as an app, offline page | Public | "Add to Home Screen" on iPhone, install prompt on Android |
| Systems console | Operators | `/systems` (phones: **More** tab for every section) |
| Social planner + comments inbox (+ AI replies) | Operators | Systems → Social |
| Growth search + prospect CRM (+ AI outreach) | Operators | Systems → Growth |
| Markets: dates, "date announced", RSVPs, capacity, guest list CSV | Operators | Systems → Events |
| Email campaigns (+ AI drafts, test send, unsubscribe) | Operators | Systems → Campaigns |
| Every order across the marketplace | Operators | Systems → Orders |
| Orders: confirm, fulfil, tracking, cancel, CSV | Curators | Dashboard → Orders |
| Discount codes (%, $, minimums, limits, expiry) | Curators | Dashboard → Discounts |
| Unlimited products, variants, inventory, SKU, tags, hide | Curators | Dashboard → Storefront |
| Store Design (6 templates) | Curators | Dashboard → Store Design |
| Clip Studio — auto-edit, captions, logo watermark, several sizes at once | Operators, curators | Systems → Clips · Dashboard → Creative Studio |
| Photo Studio — background removal, staging, looks, batch mode | Operators, curators | Systems → Photos · Dashboard → Creative Studio |
| Pro Edit (DaVinci via Iris) | Premium curators, operators | Dashboard → Pro Edit · Systems → Pro Edit |

**Studio notes:** Clip Studio renders in real time on the device — keep the
screen on until it finishes (extra sizes render one after another). First use
of captions downloads a ~41 MB speech model; first background removal
downloads ~44 MB. Both are cached afterwards. Photo Studio batch mode applies
the current stage, look and framing to up to 24 photos.

**Supabase storage:** the free plan caps uploads at 50 MB per file. Ask
curators to export 1080p for Pro Edit, or raise the limit on a paid plan.

## Open-source building blocks

- [Transformers.js](https://github.com/huggingface/transformers.js) — runs the AI models in the browser.
- [Whisper](https://github.com/openai/whisper) (MIT) — on-device captions (`onnx-community/whisper-tiny.en_timestamped`).
- [ormbg](https://github.com/schirrmacher/ormbg) (Apache-2.0) — background removal (`onnx-community/ormbg-ONNX`).
- [Apify](https://apify.com) actors — Google/Facebook groups, Instagram, TikTok search and comments.
- [Resend](https://resend.com) — transactional and campaign email.
- Worth a look next: [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0) for faster-than-real-time
  rendering on newer phones; [Postiz](https://github.com/gitroomhq/postiz-app) (self-hosted) for
  auto-publishing scheduled posts.
