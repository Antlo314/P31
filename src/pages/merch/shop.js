import { TYPES, colorTone } from '../../../supabase/functions/_shared/merch-catalog.js';
import marketMark from '../../assets/web/p31-market-mark-192.webp';

/** P31 merch in the bag: its own "shop", checked out through the merch function (Printful), not a vendor. */
export const MERCH_SHOP = { id: 'p31-merch', business_name: 'P31 Merch', slug: 'merch', logo_url: marketMark };
export const isMerch = (curatorId) => curatorId === MERCH_SHOP.id;

/** The web copy of the design that goes on this product in this colour (public/merch/thumbs). */
export const thumbFor = (item, color) => (item.type === 'mug'
  ? `/merch/thumbs/${item.design}-light.webp`
  : `/merch/thumbs/${TYPES[item.type].file(item.design, colorTone(color))}.webp`);
