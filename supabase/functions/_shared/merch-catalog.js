// P31 merch: what is for sale on p31market.com/merch, at what price, and how Printful makes it.
// One file for the page (src/pages/Merch.jsx) and the checkout (supabase/functions/merch), so a
// price shown is always the price charged. Printful variant ids and costs: Printful catalog, 2026-10-15.
// Plain JavaScript with no imports beyond the generated file list, so the browser and Deno both load it.
import { PRINT_FILES, THREADS } from './merch-files.js';

export const SITE = 'https://www.p31market.com';
/** Flat shipping per order; free above the threshold (cents). P31 covers the difference with Printful's rate. */
export const SHIPPING = { cents: 695, freeOverCents: 7500, note: 'Printed to order and shipped by our print partner in 2 to 7 business days, then 3 to 5 days in transit.' };

// Garment colours: name -> [hex, tone]. Tone picks the design version (dark ink for light garments).
const COLORS = {
  Black: ['#0c0c0c', 'dark'], Natural: ['#fef1d1', 'light'], 'Heather Prism Lilac': ['#deafcd', 'light'],
  Sand: ['#e7d3b3', 'light'], Oyster: ['#edcea5', 'light'], Stone: ['#cfc6b4', 'light'], White: ['#ffffff', 'light'],
};
export const colorHex = (c) => COLORS[c]?.[0] || '#ffffff';
export const colorTone = (c) => COLORS[c]?.[1] || 'light';

const APPAREL_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const UPCHARGE = { '2XL': 300, '3XL': 500 };

/**
 * Product types. printful: catalog product id; placement: Printful file type; variants: colour -> size -> variant id.
 * file(design, tone): the print file name in public/merch/print.
 */
export const TYPES = {
  tee: { label: 'Tee', group: 'Tees', name: 'Unisex Tee', blurb: 'Bella + Canvas 3001, soft ringspun cotton. Unisex fit.', price: 3200, printful: 71, placement: 'front', sizes: APPAREL_SIZES, upcharge: UPCHARGE,
    variants: { Black: { S: 4016, M: 4017, L: 4018, XL: 4019, '2XL': 4020, '3XL': 5295 }, Natural: { S: 14682, M: 14683, L: 14684, XL: 14685, '2XL': 14686, '3XL': 14687 }, 'Heather Prism Lilac': { S: 9374, M: 9375, L: 9376, XL: 9377, '2XL': 9378, '3XL': 9379 } },
    file: (d, tone) => `${d}-${tone}` },
  crew: { label: 'Crewneck', group: 'Sweatshirts', name: 'Crewneck Sweatshirt', blurb: 'Gildan 18000 heavy blend. Cosy, roomy, unisex.', price: 4500, printful: 145, placement: 'front', sizes: APPAREL_SIZES, upcharge: UPCHARGE,
    variants: { Black: { S: 5434, M: 5435, L: 5436, XL: 5437, '2XL': 5438, '3XL': 5439 }, Sand: { S: 16876, M: 16877, L: 16878, XL: 16879, '2XL': 16880, '3XL': 16881 } },
    file: (d, tone) => `${d}-${tone}` },
  hoodie: { label: 'Hoodie', group: 'Sweatshirts', name: 'Hoodie', blurb: 'Gildan 18500 heavy blend with a front pocket. Unisex fit.', price: 5500, printful: 146, placement: 'front', sizes: APPAREL_SIZES, upcharge: UPCHARGE,
    variants: { Black: { S: 5530, M: 5531, L: 5532, XL: 5533, '2XL': 5534, '3XL': 5535 }, Sand: { S: 12997, M: 12998, L: 12999, XL: 13000, '2XL': 13001, '3XL': 13002 } },
    file: (d, tone) => `${d}-${tone}` },
  mug: { label: 'Mug', group: 'Mugs', name: 'Mug', blurb: 'White glossy ceramic, printed on both sides. Dishwasher and microwave safe.', price: 2000, printful: 19, placement: 'default', sizes: ['11 oz', '15 oz'], upcharge: { '15 oz': 400 },
    variants: { White: { '11 oz': 1320, '15 oz': 4830 } },
    file: (d) => `mug-${d}` },
  tote: { label: 'Tote', group: 'Totes & stickers', name: 'Organic Tote', blurb: 'Econscious organic cotton tote, 15 x 16 in.', price: 2800, printful: 367, placement: 'front', sizes: ['One size'], upcharge: {},
    variants: { Oyster: { 'One size': 10458 }, Black: { 'One size': 10457 } },
    file: (d, tone) => `${d}-${tone}` },
  sticker: { label: 'Sticker', group: 'Totes & stickers', name: 'Sticker', blurb: '3 x 3 in kiss-cut vinyl sticker.', price: 500, printful: 358, placement: 'default', sizes: ['3 in'], upcharge: {},
    variants: { White: { '3 in': 10163 } },
    file: (d) => `sticker-${d}` },
  journal: { label: 'Journal', group: 'Journals & hats', name: 'Hardcover Journal', blurb: 'Matte hardcover, 8 x 5.75 in, lined pages.', price: 2400, printful: 867, placement: 'front', sizes: ['One size'], upcharge: {},
    variants: { White: { 'One size': 22658 } },
    file: (d) => `journal-${d}` },
  hat: { label: 'Dad hat', group: 'Journals & hats', name: 'Embroidered Dad Hat', blurb: 'Yupoong classic dad cap, embroidered front, adjustable strap.', price: 3000, printful: 206, placement: 'embroidery_front', sizes: ['One size'], upcharge: {},
    variants: { Black: { 'One size': 7854 }, Stone: { 'One size': 7859 } },
    file: (d, tone) => `hat-${d}-${tone}` },
};
export const GROUPS = ['Tees', 'Sweatshirts', 'Mugs', 'Totes & stickers', 'Journals & hats'];

export const DESIGNS = {
  strength: { name: 'Strength & Honour', verse: 'Proverbs 31:25', line: 'Strength and honour are her clothing; and she shall rejoice in time to come.' },
  candle: { name: 'Her Candle', verse: 'Proverbs 31:18', line: 'Her candle goeth not out by night.' },
  merchandise: { name: 'Her Merchandise Is Good', verse: 'Proverbs 31:18', line: 'She perceiveth that her merchandise is good.' },
  praised: { name: 'She Shall Be Praised', verse: 'Proverbs 31:30', line: 'A woman that feareth the Lord, she shall be praised.' },
  rise: { name: 'Rise & Build', verse: 'Proverbs 31 Marketplace', line: 'The Proverbs 31 Marketplace mark: rise and build.' },
  room: { name: 'Where Her Gifts Make Room', verse: 'Proverbs 18:16', line: 'A man’s gift maketh room for him. The Proverbs 31 Marketplace promise.' },
  pray: { name: 'Pray. Plan. Build.', verse: 'Habakkuk 2:2', line: 'Write the vision, and make it plain.' },
  hands: { name: 'Built by Her Hands', verse: 'The P31 Collective', line: 'The Collective’s hands: built by her hands, held by His.' },
  collective: { name: 'The P31 Collective', verse: 'The P31 Collective by NEBA', line: 'For the members and mentees of the P31 Collective: Kingdom women in business.' },
  virtuous: { name: 'Virtuous Woman', verse: 'Proverbs 31:10', line: 'Who can find a virtuous woman? for her price is far above rubies.' },
  rubies: { name: 'Far Above Rubies', verse: 'Proverbs 31:10', line: 'Who can find a virtuous woman? for her price is far above rubies.' },
  spindle: { name: 'The Spindle', verse: 'Proverbs 31:19', line: 'She layeth her hands to the spindle, and her hands hold the distaff.' },
  vineyard: { name: 'She Planteth a Vineyard', verse: 'Proverbs 31:16', line: 'With the fruit of her hands she planteth a vineyard.' },
  girded: { name: 'Girded With Strength', verse: 'Proverbs 31:17', line: 'She girdeth her loins with strength, and strengtheneth her arms.' },
  crest: { name: 'A Woman of Valor', verse: 'Proverbs XXXI', line: 'The Proverbs 31 crest: the crown, the laurel and the chapter that describes her.' },
  notafraid: { name: 'She Is Not Afraid', verse: 'Proverbs 31:21', line: 'She is not afraid of the snow for her household: for all her household are clothed with scarlet.' },
};

// What is for sale: a design on a product type, in the colours listed (first = shown first).
const L = (type, design, colors) => ({ id: `${type}-${design}`, type, design, colors });
export const ITEMS = [
  L('tee', 'strength', ['Black', 'Natural', 'Heather Prism Lilac']),
  L('tee', 'merchandise', ['Black', 'Natural']),
  L('tee', 'pray', ['Black', 'Natural', 'Heather Prism Lilac']),
  L('tee', 'rise', ['Black', 'Natural']),
  L('tee', 'candle', ['Black', 'Natural']),
  L('tee', 'praised', ['Natural', 'Black', 'Heather Prism Lilac']),
  L('tee', 'hands', ['Natural', 'Black']),
  L('tee', 'virtuous', ['Heather Prism Lilac', 'Black', 'Natural']),
  L('tee', 'rubies', ['Black', 'Natural', 'Heather Prism Lilac']),
  L('tee', 'girded', ['Black', 'Natural']),
  L('tee', 'crest', ['Black', 'Natural']),
  L('tee', 'notafraid', ['Natural', 'Black']),
  L('crew', 'strength', ['Black', 'Sand']),
  L('crew', 'room', ['Sand', 'Black']),
  L('crew', 'collective', ['Black', 'Sand']),
  L('crew', 'crest', ['Black', 'Sand']),
  L('crew', 'vineyard', ['Sand', 'Black']),
  L('hoodie', 'rise', ['Black', 'Sand']),
  L('hoodie', 'pray', ['Black', 'Sand']),
  L('hoodie', 'collective', ['Black', 'Sand']),
  L('hoodie', 'girded', ['Black', 'Sand']),
  L('hoodie', 'crest', ['Black', 'Sand']),
  L('mug', 'candle', ['White']),
  L('mug', 'merchandise', ['White']),
  L('mug', 'pray', ['White']),
  L('mug', 'room', ['White']),
  L('mug', 'rise', ['White']),
  L('mug', 'rubies', ['White']),
  L('mug', 'spindle', ['White']),
  L('mug', 'vineyard', ['White']),
  L('mug', 'notafraid', ['White']),
  L('mug', 'crest', ['White']),
  L('tote', 'room', ['Oyster', 'Black']),
  L('tote', 'hands', ['Oyster', 'Black']),
  L('tote', 'strength', ['Oyster', 'Black']),
  L('tote', 'vineyard', ['Oyster', 'Black']),
  L('tote', 'spindle', ['Oyster', 'Black']),
  L('sticker', 'rise', ['White']),
  L('sticker', 'hands', ['White']),
  L('sticker', 'pray', ['White']),
  L('sticker', 'candle', ['White']),
  L('sticker', 'rubies', ['White']),
  L('sticker', 'crest', ['White']),
  L('sticker', 'spindle', ['White']),
  L('journal', 'pray', ['White']),
  L('journal', 'room', ['White']),
  L('journal', 'strength', ['White']),
  L('journal', 'crest', ['White']),
  L('journal', 'vineyard', ['White']),
  L('hat', 'pray', ['Black', 'Stone']),
  L('hat', 'crest', ['Black', 'Stone']),
];

export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
export const itemName = (item) => `${DESIGNS[item.design].name} ${TYPES[item.type].label}`;
/** Price in cents for one of this item in this size. */
export const priceFor = (item, size) => TYPES[item.type].price + (TYPES[item.type].upcharge[size] || 0);
export const fromPrice = (item) => TYPES[item.type].price;
/** The print file for this item and colour: name, public URL and size in pixels. */
export function printFile(item, color) {
  const name = TYPES[item.type].file(item.design, colorTone(color));
  const size = PRINT_FILES[name];
  return size ? { name, url: `${SITE}/merch/print/${name}.png`, width: size[0], height: size[1], threads: THREADS[name] || null } : null;
}
/** Is this colour and size a real Printful variant of the item? Returns the variant id or null. */
export const variantFor = (item, color, size) => (item.colors.includes(color) ? TYPES[item.type].variants[color]?.[size] || null : null);
/** A quick picture when Printful's photo is not ready: the design preview on the garment colour. */
export const previewImage = (item, color) => `/merch/print/${TYPES[item.type].file(item.design, colorTone(color))}.png`;
export const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
