// The Curator Studio walkthrough: opens by itself the first time a vendor signs in, and
// replays from Help & Guide or the setup list. Each step opens the room it talks about.
export const CURATOR_TOUR_ID = 'curator-studio';

/** Open the walkthrough from anywhere in the studio (Help & Guide, the setup list). */
export const startCuratorTour = () => window.dispatchEvent(new CustomEvent('p31:tour', { detail: CURATOR_TOUR_ID }));

// Same order as the "Set up your shop" list, in plain words; each step is short enough for a phone.
export const CURATOR_TOUR = [
  {
    title: 'Welcome to your studio',
    body: 'This is where you build and run your shop. This short tour opens each part as it goes. Tap Next to move on. You can replay it any time with Show me around.',
  },
  {
    to: '/dashboard/identity', targets: ['[data-tour="checklist"]'],
    title: 'Your setup list',
    body: 'Six steps to a finished shop. Each one ticks itself when it is done, and the button beside it takes you to the right place. At the bottom it tells you if your shop is live or waiting for P31 to approve it.',
  },
  {
    to: '/dashboard/identity', targets: ['#shop-name', '[data-tour="identity-form"]'],
    title: '1. Your shop name and link',
    body: 'Type your shop name; your shop link (p31market.com/your-shop) fills in from it. Add a few lines about you and what you make. Press Save shop details. If you leave before saving, what you typed is kept on this device.',
  },
  {
    to: '/dashboard/storefront', targets: ['[data-tour="aesthetics"]'],
    title: '2. Your logo and banner',
    body: 'Tap the wide box for your banner and the square box for your logo. Phone photos are fine; they save as soon as they upload.',
  },
  {
    to: '/dashboard/storefront', targets: ['[data-tour="add-product"]'],
    title: '3. Add a product',
    body: 'Tap Add product. Add photos (up to 10), a name and a price; a short description helps. Press Save product. You can list up to 10 products.',
  },
  {
    to: '/dashboard/storefront', targets: ['[data-tour="payments"]'],
    title: '4. Get paid with Stripe',
    body: 'Tap Connect with Stripe and follow its steps (about 5 minutes; have your bank details ready). Shoppers then pay by card or Apple Pay and the money goes to your bank.',
  },
  {
    to: '/dashboard/design', targets: ['.sd-templates', '.sd'],
    title: '5. Your look',
    body: 'Pick a template and a colour. The small preview shows your shop. Press Save and publish design when you like it.',
  },
  {
    to: '/dashboard/orders', targets: ['.ord', '[data-tour="nav-orders"]'],
    title: '6. Orders',
    body: 'When someone buys, the order shows here with what to send and where. Mark it shipped and the shopper gets an email.',
  },
  {
    to: '/dashboard/billing', targets: ['[data-tour="billing-status"]', '[data-tour="nav-billing"]'],
    title: '7. Your plan',
    body: 'Your shop is free for the first 3 months, then $14.99 a month, plus 5% of each sale. This page shows your free months left; we email you before anything is charged.',
  },
  {
    to: '/dashboard/identity', targets: ['[data-tour="nav-concierge"]', '[data-tour="checklist"]'],
    title: 'Need help?',
    body: 'Write to the P31 team from Concierge (in the menu) or email vendor@p31market.com. Tap Show me around on your setup list to see this tour again.',
  },
];
