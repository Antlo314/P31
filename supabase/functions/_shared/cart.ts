// Turns a shopper's bag into trusted order lines. Prices, stock and options
// always come from the database — never from the browser.
// deno-lint-ignore-file no-explicit-any

export type CartItemIn = { productId: number | string; quantity?: number; options?: Record<string, string> };
export type Line = {
  product_id: number;
  name: string;
  price_cents: number;
  quantity: number;
  options: Record<string, string>;
  image_url: string | null;
};

export class CartError extends Error {}

export async function buildLines(admin: any, curatorId: string | null, items: CartItemIn[]) {
  if (!Array.isArray(items) || items.length === 0) throw new CartError('Your bag is empty.');
  if (items.length > 30) throw new CartError('Too many items in one order.');

  const ids = [...new Set(items.map((i) => Number(i.productId)).filter(Number.isFinite))];
  const { data: products, error } = await admin
    .from('products')
    .select('id, curator_id, name, price, image_url, stock_status, inventory, is_active, variants')
    .in('id', ids);
  if (error) throw new CartError('Could not load products.');

  const byId = new Map((products || []).map((p: any) => [p.id, p]));
  const shop = curatorId || (products?.[0]?.curator_id ?? null);
  const lines: Line[] = [];

  for (const it of items) {
    const p: any = byId.get(Number(it.productId));
    if (!p || p.is_active === false) throw new CartError('An item in your bag is no longer available.');
    if (p.curator_id !== shop) throw new CartError('Each checkout can only include items from one shop.');
    if (p.stock_status === 'out_of_stock' || p.inventory === 0) throw new CartError(`${p.name} is sold out.`);

    const quantity = Math.min(Math.max(parseInt(String(it.quantity ?? 1), 10) || 1, 1), 20);
    if (p.inventory != null && quantity > p.inventory) {
      throw new CartError(`Only ${p.inventory} of ${p.name} left.`);
    }

    // Keep only options that exist on the product.
    const options: Record<string, string> = {};
    for (const group of (Array.isArray(p.variants) ? p.variants : [])) {
      const chosen = it.options?.[group.name];
      if (!chosen || !(group.options || []).includes(chosen)) {
        throw new CartError(`Choose a ${String(group.name).toLowerCase()} for ${p.name}.`);
      }
      options[group.name] = chosen;
    }

    const price_cents = Math.round(parseFloat(p.price) * 100);
    if (!Number.isFinite(price_cents) || price_cents <= 0) throw new CartError(`${p.name} doesn't have a valid price.`);

    lines.push({ product_id: p.id, name: p.name, price_cents, quantity, options, image_url: p.image_url || null });
  }

  const subtotal = lines.reduce((s, l) => s + l.price_cents * l.quantity, 0);
  return { shop, lines, subtotal };
}

// Discount via the database function (single source of truth).
export async function discountFor(admin: any, curatorId: string, code: string | undefined, subtotal: number) {
  if (!code) return { ok: false, amount_cents: 0, code: null as string | null, message: '' };
  const { data } = await admin.rpc('compute_discount', {
    p_curator_id: curatorId, p_code: code, p_subtotal_cents: subtotal,
  });
  return data?.ok ? data : { ok: false, amount_cents: 0, code: null, message: data?.message || '' };
}
