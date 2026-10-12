// The Curator Studio walkthrough: opens by itself the first time a vendor signs in, and
// replays from Help & Guide or the setup list. Each step opens the room it talks about.
export const CURATOR_TOUR_ID = 'curator-studio';

/** Open the walkthrough from anywhere in the studio (Help & Guide, the setup list). */
export const startCuratorTour = () => window.dispatchEvent(new CustomEvent('p31:tour', { detail: CURATOR_TOUR_ID }));

export const CURATOR_TOUR = [
  {
    title: 'Welcome to your studio',
    body: 'This is where your shop gets built and run. The walkthrough takes two minutes and opens each room as it goes. Use Next or the arrow keys. Replay it any time from Help & Guide.',
  },
  {
    to: '/dashboard/identity', targets: ['[data-tour="identity-form"]'],
    title: '1. Who you are',
    body: 'Your business name, a one-line tagline, your story (tap Write with AI for a first draft) and your shop link, p31market.com/your-name. Add your city, Instagram and the email shoppers can write to, then Save at the bottom.',
  },
  {
    to: '/dashboard/storefront', targets: ['[data-tour="aesthetics"]'],
    title: '2. Your banner and logo',
    body: 'The wide banner sits behind your name; the square logo is your mark. Tap either box to upload straight from your phone, then press Save Settings.',
  },
  {
    to: '/dashboard/storefront', targets: ['[data-tour="payments"]', '#payment-links-section'],
    title: '3. How you get paid',
    body: 'Connect with Stripe and shoppers pay by card right on your page, with the money going to your bank. Cash App, Venmo or a payment link work as backups.',
  },
  {
    to: '/dashboard/storefront', targets: ['[data-tour="add-product"]'],
    title: '4. Your products',
    body: 'Add Artifact opens the product form: start from a template, add a photo (the Photo Studio cleans the background in one tap), then name, price, description, options, a badge and a sale timer. Up to ten products.',
  },
  {
    to: '/dashboard/design', targets: ['[data-tour="templates"]', '.sd-templates'],
    title: '5. Your look, in one tap',
    body: 'Six templates, your accent colour, fonts and layout. The preview updates as you go, and Publish design makes it live on your shop.',
  },
  {
    to: '/dashboard/marketing', targets: ['.mk-tabs'],
    title: '6. Get seen',
    body: 'Every product gets its own link and QR code, a promo image, and captions and hashtags written for you. Shoppers who follow your shop get your emails. Insights shows what people open and buy.',
  },
  {
    to: '/dashboard/orders', targets: ['[data-tour="nav-orders"]', '.ord'],
    title: '7. Orders, discounts, reviews',
    body: 'Orders arrive here with the buyer’s details. Discounts makes codes like WELCOME10 for checkout; Testimonials puts customer quotes on your shop.',
  },
  {
    to: '/dashboard/billing', targets: ['[data-tour="billing-status"]', '[data-tour="nav-billing"]'],
    title: '8. Your plan',
    body: 'Your storefront is complimentary for its first months. This page counts down the free period, and one button sets up the monthly subscription through Stripe when you are ready; the first charge waits until the free period ends. We email you before anything changes.',
  },
  {
    to: '/dashboard/identity', targets: ['[data-tour="checklist"]'],
    title: 'Your setup list',
    body: 'This card tracks what is done and what is next, with a button for each step. When every line is ticked, your shop is ready to share. Questions go to Concierge, where the P31 team answers.',
  },
];
