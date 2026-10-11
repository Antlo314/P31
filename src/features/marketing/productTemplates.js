// Starting points for a new product: the category, the options shoppers pick, tags and a
// description scaffold the maker edits. Picking one fills the form; nothing is locked.

export const PRODUCT_TEMPLATES = [
  {
    id: 'candle', name: 'Candle', emoji: '🕯️', category: 'Home', badge: 'Handmade',
    tags: 'handmade, candle, soy, gift',
    variants: [{ name: 'Scent', options: 'Lavender, Vanilla, Eucalyptus' }, { name: 'Size', options: '4 oz, 8 oz' }],
    description: 'Hand-poured in small batches with [wax type] and a cotton wick. [Scent notes]. Burns about [hours] hours. Trim the wick before each light.',
  },
  {
    id: 'jewelry', name: 'Jewelry', emoji: '💍', category: 'Collection', badge: 'Handmade',
    tags: 'handmade, jewelry, gift',
    variants: [{ name: 'Length', options: '16", 18", 20"' }, { name: 'Finish', options: 'Gold, Silver' }],
    description: '[Metal / material], made by hand in [city]. [What makes it special]. Comes in a gift box, ready to give.',
  },
  {
    id: 'skincare', name: 'Skincare', emoji: '🧴', category: 'Skin', badge: 'New',
    tags: 'skincare, natural, handmade',
    variants: [{ name: 'Size', options: '2 oz, 4 oz' }],
    description: 'Made with [key ingredients]. For [skin type / use]. How to use: [steps]. No [what you leave out]. [Size] jar.',
  },
  {
    id: 'apparel', name: 'Apparel', emoji: '👕', category: 'Apparel', badge: null,
    tags: 'apparel, womenowned',
    variants: [{ name: 'Size', options: 'S, M, L, XL, 2XL' }, { name: 'Color', options: 'Black, Cream' }],
    description: '[Fabric] with a [fit] fit. [Print / message and the story behind it]. Machine wash cold, hang dry. Model wears a [size].',
  },
  {
    id: 'art', name: 'Art print', emoji: '🖼️', category: 'Art', badge: 'Limited',
    tags: 'art, print, home decor',
    variants: [{ name: 'Size', options: '8x10, 11x14, 16x20' }, { name: 'Frame', options: 'Unframed, Framed' }],
    description: 'Printed on [paper] with archival inks. [The piece and what inspired it]. Signed. Ships flat in a protective sleeve.',
  },
  {
    id: 'bakery', name: 'Baked goods', emoji: '🧁', category: 'Wellness', badge: 'Bestseller',
    tags: 'baked, homemade, treats',
    variants: [{ name: 'Quantity', options: 'Half dozen, Dozen' }],
    description: 'Baked fresh to order with [key ingredients]. [Flavor and texture]. Contains [allergens]. Best within [days] days; pickup at the market or local delivery.',
  },
  {
    id: 'wellness', name: 'Wellness', emoji: '🌿', category: 'Wellness', badge: null,
    tags: 'wellness, selfcare, natural',
    variants: [{ name: 'Size', options: 'Travel, Full' }],
    description: '[What it is] made with [ingredients]. For [moment / need]. How to use: [steps]. [What you leave out].',
  },
  {
    id: 'home', name: 'Home goods', emoji: '🏠', category: 'Home', badge: 'Handmade',
    tags: 'home, handmade, decor',
    variants: [{ name: 'Color', options: 'Natural, Sage, Plum' }],
    description: '[Material] made by hand. [Size and use]. [Care]. Each one is a little different, which is the point.',
  },
  {
    id: 'digital', name: 'Digital / service', emoji: '✨', category: 'Collection', badge: null,
    tags: 'digital, service',
    variants: [],
    description: '[What they receive and how] within [time]. [Who it is for]. [What is included]. Delivered by email after purchase.',
  },
];

export const PRODUCT_BADGES = ['New', 'Bestseller', 'Limited', 'Handmade', 'Gift', 'Back in stock', 'Small batch', 'Market exclusive'];

/** Apply a template to the product form (keeps anything the maker already typed). */
export const applyTemplate = (form, t) => ({
  ...form,
  category: t.category,
  badge: form.badge || t.badge || '',
  tags: form.tags || t.tags,
  variants: form.variants?.length ? form.variants : t.variants.map((v) => ({ ...v })),
  description: form.description || t.description,
});
