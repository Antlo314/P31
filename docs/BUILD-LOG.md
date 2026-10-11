# P31 build log

A running record of what has been built for Proverbs 31 Marketplace and The P31 Collective, written for the CEO's report. Newest first. Dates are 2026.

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
