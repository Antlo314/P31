# P31 build log

A running record of what has been built for Proverbs 31 Marketplace and The P31 Collective, written for the CEO's report. Newest first. Dates are 2026.

## October 11 — The Collective, warmer and quieter

- **Less aerospace, more sanctuary.** Across thep31collective.org the celestial elements are gone: the 3D arches and drifting motes, the spinning gem on the Join page, the orbital gold rings, the floating sparkles and the 3D card tilt. In their place: a soft plum gradient with one warm gold glow at the base of each dark section, a gold hairline, and the brand mark. Plum, gold, the logo and the type are unchanged. The marketplace keeps its own look.
- **The home page leads with people, not tools.** A new "You belong here" section opens the page with the four things the Collective is for: Mentorship (walk with a mentor), Healing (rooted in NEBA Women’s Ministry), Fellowship (a sisterhood), and Purpose & growth. Then Melanie JC, the two mentorship paths, her mandate, the ways to book a call, and the team. The Systems and Content Studio doors moved to one quiet line at the foot of the page; the nav and the portal still carry them for the team.
- **Newsletter buttons match the pop-up.** Every button that opens the marketplace sign-up now says "Subscribe to our newsletter" (home hero, footer, Our Story, Market dates), and the home-page newsletter block reads "Stay in the Know" with the same text as the pop-up.

## October 11 — The December event: Business and Leadership Luncheon

- **Renamed and connected.** The December event on p31market.com is now the **Business and Leadership Luncheon** (was "Winter Gala"): Saturday, December 19, 1:30 to 5 PM at The Four Event Center, 8599 Roswell Rd Suite B, Atlanta, with the Eventbrite ticket link, so the home page and Market dates show the date, the venue, directions and "Get tickets" instead of a free RSVP.
- **"December · date coming soon."** Markets can now announce their month before the day is set (a new "Announce the month" switch in Systems → Markets & events). The site reads "December · date coming soon" until "Date announced" is turned on. The hero chip reads "Up next" so it fits a luncheon as well as a market.
- **The Luncheon on Instagram and Facebook.** The three scheduled "Winter Gala" posts (Oct 17, Oct 24, Nov 7) were removed and replaced with Luncheon posts at the same times, and three more follow on Saturdays Nov 14, 21 and 28: the announcement with date and venue, "which seat is yours", what the ticket includes, a finish-the-sentence on business advice, a four-Saturdays countdown, and a business-casual this-or-that. Every caption carries the ticket link (`marketing/social/2026-10-17-luncheon`).
- **The Collective's Instagram.** The Instagram icon on thep31collective.org now opens @the.p31collective instead of the marketplace account.
- **The marketplace pop-up** now reads as the newsletter sign-up Melanie JC wrote: "Stay in the Know", the invitation to subscribe for news, highlights, events and opportunities for faith-driven women in business and purpose, First Name, Email Address, an optional phone number, "Subscribe to Our Newsletter", and the privacy line.

## October 11 — JotForm retired: the vendor forms live on the site

- **Four forms moved onto p31market.com, word for word.** The Storefront Agreement (`/vendors/agreement`), the Vendor Reservation with the full Vendor Rules & Regulations (`/vendors/register`), the Vendor Feedback Survey (`/vendors/feedback`) and the Volunteer Day-of-Event Acknowledgment (`/volunteer`), plus a hub at `/vendors` that lists them with the vendor application. Every question, every rule, every acknowledgment is the same text vendors signed on JotForm; the agreement carries a version stamp so future changes are traceable.
- **Signed on a phone or a computer.** A draw-to-sign box (open-source signature_pad) with the typed name and date kept alongside; the registration takes the business logo too. Each person gets a copy of what they signed by email, from vendor@ (volunteers from outreach@); the team gets the submission in its inbox with one link into Systems.
- **Connected, not just collected.** A signed agreement attaches to the vendor's curator account the moment the emails match (now, or when she registers later); her studio shows a reminder and a checklist step until it is signed. A market registration can be dropped into that market's lineup in one tap, logo included, and the logo shows on the public Market dates page. A survey answer of "I'm in for the next market" can invite her straight into the next lineup. Everyone who signs is in the CRM with what they did.
- **Systems → Market → Vendor forms.** Four tabs (Agreements, Registrations, Feedback, Volunteers) with search, status, CSV export, the signature and logo on each record, and the actions: pre-approve and email the account link (the "7–10 days" promise on the agreement), confirm / waitlist / decline a registration with the market's details in the email, invite from the survey, average scores per market. New submissions show on the Overview and on Today.
- **Behind it.** Database v37 (four tables, the `submit_form` door with bot trap and rate limits, the lineup and pre-approval actions, a public logo bucket); `join-notify` learned the four flows and sends the signer's copy; `vendor-decision` sends the account link and the registration decisions; the approval email for applications now points vendors to the registration and the agreement. 23 new screens in the automated screen test.

## October 11 — Auto-create in Content Studio

- **Auto-create.** A new room in Content Studio: choose the kinds of posts and their share (Bible fill-in-the-blank, finish the sentence, this or that, pop quiz, Sunday word, invitations, business tips), the look (five card styles: Night, Lavender, Ivory, Gold, Royal), the start date, how many days (7 to 90) and how often (daily to twice a week), and the times (from Zernio’s own engagement data, P31 defaults, or typed in per weekday). It skips days that already have a post. One tap drafts every card and caption.
- **Pre-posts.** The preview shows each card drawn in the browser with its caption and time; any can be swapped for another from the library, rewritten with AI, edited, retimed or removed. Then “Save as drafts” puts them in the Planner for review, or “Schedule all” draws, uploads and books the whole run to Instagram and Facebook with a progress bar. A Pre-posts tab lists everything generated and not yet sent, with approve and schedule-all-approved.
- **The library.** A starter set of 42 KJV verses with their blanked word, 14 Sunday verses, 12 sentence starters, 10 this-or-that choices, 7 quizzes, 5 invitations and 10 business tips, each used once before any repeats. The team adds its own in the Library tab and can switch any item off. Captions open with rotating hooks so a month of the same format never reads the same twice.
- **Behind it.** Cards are drawn in the browser with html-to-image (open source, MIT) using the site’s own fonts, so what you preview is what posts. Database v36 adds the library, the series record and the card on each planned post.

## October 11 — Thirty days of posts

- **24 posts scheduled, Oct 12 – Nov 10,** on every day the October calendar did not already cover, so Instagram and Facebook get something daily for a month. Ten are the Bible fill-in-the-blank format that drew the most replies; the rest are finish-the-sentence prompts, this-or-that choices, two pop quizzes, three Sunday "comment Amen" verses, and one honest invitation a week (vendor applications for the Winter Gala, the Collective's mentorship, the Gala notify list). Every card is drawn in the P31 look with the new mark; every caption opens with a hook and asks one real question. Times come from 28 days of Instagram "followers online" data: weekdays 12–3 PM and 7–9 PM, Saturday 6 PM, Sunday 1 PM Eastern.
- **Google Business Profile logo and cover** redrawn with the new mark and ready to push; the Google connection in Zernio has lapsed, so it is one reconnect and one command.

## October 11 — Cleaner mark, DaVinci paused

- **The hands mark, cleaned.** The original art (only 381 pixels wide) had a beaded light outline along every curve, which showed as white dots on dark backgrounds, in texted links and on the app icon. The mark was rebuilt from the original: outline smoothed, the beads and a ribbed texture removed, flat colour and the finger lines kept. Every icon, favicon, share image, the brand kit and the in-app marks were regenerated, and phones are told to fetch the new icons.
- **Profile picture for Instagram and Facebook.** A square tile with the mark (`marketing/brand/profile-1024.png`) for the @proverbs31market accounts, which currently show a blank avatar. Instagram offers no way to set it through an API, so it is a one-minute upload in the app.
- **DaVinci paused.** The DaVinci clip finder and Iris queue are greyed out everywhere (console menu, Overview, Today, the portal) with a "paused for now" page, kept behind one switch (`src/lib/features.js`) for when the bridge is ready.

## October 11 — The admin console, by site, on any screen

- **Systems is now split by site.** The team console (thep31collective.org/systems) is organized as Market (p31market.com: orders, vendor applications, markets & events, curators & shops, campaigns), Collective (thep31collective.org: join applications, mentorship, people, Content Studio, email inbox), Create (social, growth, Photo Studio, Clip Studio, DaVinci) and Team (access, health, settings). Every page carries a line saying which site and room it belongs to.
- **A new front page.** The Overview opens with "what needs you" across both sites, then a Market section (open orders, paid this month, shops live, the next market with its lineup count, plus new orders, vendor applications and shops to review) and a Collective section (new join applications, students active, emails waiting, posts scheduled, plus the applications, emails, DMs and posts going out), then the creative tools and the team pages.
- **Phones get what works on phones.** The bottom bar holds Overview, Orders, Vendors and Join; "More" lists every room by site. The two video tools (Clip Studio, the DaVinci clip finder) need a computer, so on a phone they explain what they do, point to what you can do right there, and can email you the link; the DaVinci edit queue still works on a phone. The same applies in Content Studio and in each vendor's Creative Studio, where Photo Studio and the promo image maker stay fully usable on a phone.
- **Today** uses the same attention cards as the console and marks each one Market or Collective.

## October 10 (night) — One-step vendor approval, share previews

- **Approving an application is the whole job.** Setting a vendor application to Approved in Systems now pre-approves her email on its own: she registers at p31market.com/register with that email and her studio opens at once (and if she had already signed up while waiting, it opens the moment she is approved). The welcome email reminds her to use the same email. Declining later removes the pre-approval. No more second step in Vendor Approvals.
- **Shop and product links look like the thing being sold.** When a vendor shares p31market.com/her-shop or a product link in an Instagram story, a text, WhatsApp, Facebook or X, the preview now shows that shop's banner, or that product's photo, name and price, instead of the generic marketplace card. Google sees the same, with proper Store and Product data. Served at the edge for link crawlers only; shoppers get the normal app.

## October 10 (evening) — Studio walkthrough, menus, Pro Edit hidden

- **A walkthrough inside the studio.** New vendors now get a guided tour the first time they sign in: nine steps that open each room (Identity, banner and logo, payments, products, Store Design, Marketing, Orders) and point at the actual buttons. It replays from Help & Guide or the setup list.
- **Set up your shop list.** The Identity page opens with a checklist that ticks itself as the vendor works (name/story/link, banner and logo, payments, first product, look, promote) with a "Do this" button for each step and a progress bar.
- **Smaller menus.** The studio menu is five short groups (Your shop, Sell, Grow, Help, Admin) that fold; on phones the whole menu sits behind one button so the page comes first. Systems sidebar groups fold too.
- **Pro Edit hidden** from vendors and the public Systems page until it is needed; the team's DaVinci tool is unchanged.

## October 10 (later) — Vendor marketing

- **Marketing tab for every vendor.** Each curator's studio now has a Marketing tab with four rooms. *Promote a product*: pick any product and get its own link (opens the item directly), a QR code, a promo image drawn on the spot in four looks (Clean, Plum, Sale, Noir) and three sizes (post, portrait, story) with a ribbon and a scan-to-shop QR, and one tap that writes three captions, hook lines, a story line, hashtags, an email and a text message for that product. *Followers & email*: the shop's own email list, with an AI-written email, a test send, one real send a day (from the market address, replies go to the vendor), and a history. *Share kit*: shop link, bio line, ready-to-post lines, and a printable 5×7 table sign with the QR for the physical market. *Insights*: opens, buy taps and shares per product over 7/30/90 days, which products are quiet, and six plain-language tips on what sells on P31.
- **Product templates.** Adding a product starts from a template (candle, jewelry, skincare, apparel, art print, baked goods, wellness, home goods, digital/service) that fills the category, the options shoppers pick, tags and a description scaffold.
- **Badges, featured, sale timers.** Products can carry a badge (New, Bestseller, Limited, Handmade, Gift, Back in stock, Small batch, Market exclusive), be pinned first in the shop, and run a sale with an end time; shoppers see "Sale ends in 3 days" and the sale tag drops by itself when it passes.
- **Storefront.** Every shop now has a "Get updates from this shop" box (with the follower count), a share button on every product that copies its own link, and badges on the product cards. One-click unsubscribe per shop.
- **Behind it.** Database v34 (badge, featured, sale end; shop followers; shop emails; per-product numbers), a `shop-broadcast` sender, two new AI writing tasks, and a sample vendor in the walkthrough data so every screen is tested on each push (100 screens now).

## October 10 — Studio, brand, speed, vendors

- **Speed on phones.** Both sites' fonts are now served from our own domain (nothing from Google blocks the first paint any more), React ships as one cached file, dozens of tiny icon files became one, and the hero film waits for the page to load on phones. The Collective home no longer "jumps" when it loads. Everything is locked to the screen width.
- **The brand mark everywhere.** The hands mark (Proverbs 31 Collective by NEBA) was cleaned up and enlarged, and is now the icon, favicon, home-screen icon and share image for both p31market.com and thep31collective.org, with a brand kit (colors, type, logo rules, voice) in `marketing/brand`.
- **Clip Studio.** Captions now follow the voice itself (they start on the word and clear when the speech stops), ten ready-made text styles with new fonts and animations (bold caps, karaoke, bounce, typewriter, gold shimmer, handwritten and more), a "hook" line for the first 2.4 seconds, and an Instagram safe-zone guide so text never sits under the app's own buttons.
- **Content planner.** A social calendar months ahead with AI-drafted hooks, captions and hashtags per post, Yanni's approval, and one-tap scheduling to Instagram and Facebook through Zernio. A sound board of trending Instagram audio that can be attached to reels when they publish.
- **Vendor lineups.** Each market has a vendor lineup in Systems (invite from the application list, booth numbers, confirm, paid, check-in on the day), published on Market dates when ready.
- **Email, with Carla.** Everything sent to members@ and vendor@ lands in Content Studio → Email with a reply Carla drafted; a person edits and sends. Flagged emails (refunds, complaints, press) wait for a human.
- **Vendor applications on the site.** The vendor interest form lives at p31market.com/apply in the site's design; applications land in Systems, email the team, and fill a row in P31's Google Sheet, next to the Google Form rows.
- **Join applications.** The same for the Collective membership form (thep31collective.org/join): Systems, an email to members@, and a row in the Collective sheet.

## October 9–10 — Team home, access, DaVinci

- **Today.** The team's home page: everything that needs attention from every dashboard a person runs (grading, student messages, intro calls, classes, applications, orders, curators, site errors, DMs, posts going out).
- **Systems in four rooms.** People, Content, Market, Settings & Health.
- **Team access by email.** Admins have full control; others get only the tools they are given. Anthony → DaVinci. Yanni → Content Studio. Students land in their own classroom.
- **DaVinci clip finder.** Long raw footage stays on the device; the finder scores it by sound, speech and motion and proposes the best clips (15–90 s), each with its own look and music, then queues them for Iris to build in DaVinci Resolve.
- **Walkthroughs.** Content Studio and each classroom open with a guided tour the first time.
- **New look.** Three.js 3D accents, layered parallax, 3D card tilt, a student preview window in the mentor console, and a GPU-powered Clip Studio (looks and filters, fast export, on-device captions).

## October 7–8 — Collective site, security, health

- Academy and Systems split, Melanie JC's story and the team directory, "Join P31 Collective" everywhere, curator and product privacy, a native membership application, error reporting with a Health page, automatic checks on every push, a site-wide scan, and a Bluehost guide for the email setup.

## Before October

- The marketplace (shop, curators, market dates, curator studio), the mentorship academy with live classrooms, the Content Studio connected to Instagram and Facebook, Carla (the DM assistant), the CRM, email campaigns, and the Systems console.
