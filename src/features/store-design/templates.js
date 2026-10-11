// Storefront templates. A template is a starting point; curators can then
// change the accent, fonts, layout and sections. Saved to
// curator_data.store_design and applied by CuratorProfile.

export const STORE_TEMPLATES = [
  {
    id: 'atelier', name: 'Atelier', blurb: 'The signature P31 look — lavender light, plum and gold.',
    preview: ['#F8F3FA', '#3A1C36', '#D9A93A'],
    defaults: { accent: '#3A1C36', heading: 'serif', hero: 'banner', columns: 3, cards: 'soft', buttons: 'pill', productsFirst: false },
  },
  {
    id: 'boutique', name: 'Boutique', blurb: 'Warm cream, framed cards and gold — for jewelry & beauty.',
    preview: ['#FFFAF3', '#8A6D1A', '#E8D9BE'],
    defaults: { accent: '#8A6D1A', heading: 'serif', hero: 'tall', columns: 3, cards: 'framed', buttons: 'pill', productsFirst: false },
  },
  {
    id: 'gallery', name: 'Gallery', blurb: 'Crisp white, big imagery, products first — for art & prints.',
    preview: ['#FFFFFF', '#111111', '#E6E6E6'],
    defaults: { accent: '#111111', heading: 'sans', hero: 'minimal', columns: 4, cards: 'minimal', buttons: 'square', productsFirst: true },
  },
  {
    id: 'editorial', name: 'Editorial', blurb: 'Magazine layout with large two-up product spreads.',
    preview: ['#F6F1EA', '#3A1C36', '#C8B8A4'],
    defaults: { accent: '#3A1C36', heading: 'serif', hero: 'tall', columns: 2, cards: 'framed', buttons: 'square', productsFirst: false },
  },
  {
    id: 'market', name: 'Market', blurb: 'Fresh and friendly, shop-first — for food, wellness & goods.',
    preview: ['#F6FFF9', '#374126', '#17A673'],
    defaults: { accent: '#374126', heading: 'sans', hero: 'banner', columns: 3, cards: 'soft', buttons: 'rounded', productsFirst: true },
  },
  {
    id: 'noir', name: 'Noir Luxe', blurb: 'Dark, dramatic and gold — for evening wear & fragrance.',
    preview: ['#21101E', '#F2CE4D', '#3A1C36'],
    defaults: { accent: '#F2CE4D', heading: 'serif', hero: 'tall', columns: 3, cards: 'soft', buttons: 'pill', productsFirst: false },
  },
];

export const ACCENTS = ['#3A1C36', '#9B71B2', '#D9A93A', '#8A6D1A', '#374126', '#17A673', '#B83C6E', '#3A1C36', '#111111', '#F2CE4D'];

export const DEFAULT_DESIGN = { template: 'atelier', ...STORE_TEMPLATES[0].defaults, showAbout: true, showTestimonials: true };

// Merge whatever is saved with today's defaults so older/partial designs work.
export const resolveDesign = (saved) => {
  const s = saved && typeof saved === 'object' ? saved : {};
  const tpl = STORE_TEMPLATES.find((t) => t.id === s.template) || STORE_TEMPLATES[0];
  return { ...DEFAULT_DESIGN, ...tpl.defaults, ...s, template: tpl.id };
};

// Classes + CSS variables for the storefront root.
export const designAttrs = (design) => ({
  className: [
    'store',
    `store-tpl-${design.template}`,
    `store-cards-${design.cards}`,
    `store-btn-${design.buttons}`,
    `store-hero-${design.hero}`,
    `store-head-${design.heading}`,
    design.productsFirst ? 'store-products-first' : '',
  ].join(' '),
  style: { '--store-accent': design.accent, '--store-cols': design.columns },
});
