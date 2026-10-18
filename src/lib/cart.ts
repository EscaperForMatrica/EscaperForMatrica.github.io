import crypto from 'node:crypto';
import { db } from './db';
import { hydrate, type Product } from './catalog';
import { evaluatePromo, promoLabel, type Promo } from './promo';
import { ownerKey, cartMode } from './session';

export interface CartLine {
  product: Product;
  qty: number;
  price: number;
  oldPrice: number | null;
  total: number;
  oldTotal: number | null;
  boxes: number;
  available: boolean;
  note?: string;
}

export interface Cart {
  mode: 'retail' | 'b2b';
  lines: CartLine[];
  count: number;
  positions: number;
  boxes: number;
  itemsTotal: number;
  oldTotal: number;
  savings: number;
  promo?: Promo;
  promoCode?: string;
  promoLabel?: string;
  promoError?: string;
  discount: number;
  total: number;
  hash: string;
}

const EMPTY = (mode: 'retail' | 'b2b'): Cart => ({ mode, lines: [], count: 0, positions: 0, boxes: 0, itemsTotal: 0, oldTotal: 0, savings: 0, discount: 0, total: 0, hash: '' });

export function promoCustomerKeys(locals: App.Locals, phone?: string): string[] {
  const keys: string[] = [];
  if (locals.user) keys.push(`u:${locals.user.id}`, locals.user.phone);
  if (phone) keys.push(phone);
  return keys;
}

export function getCart(locals: App.Locals, mode = cartMode(locals)): Cart {
  const owner = ownerKey(locals);
  if (!owner) return EMPTY(mode);
  const rows = db.all(
    `select ci.qty, p.*, c.slug as category_slug, c.name as category_name from cart_items ci
     join products p on p.id = ci.product_id left join categories c on c.id = p.category_id
     where ci.owner = ? and ci.mode = ? order by ci.added_at, p.id`,
    owner, mode,
  );
  const lines: CartLine[] = rows.map((r) => {
    const product = hydrate(r);
    const wholesale = mode === 'b2b';
    const price = (wholesale ? product.wholesale_price ?? product.price : product.price) ?? 0;
    const oldPrice = wholesale ? product.price : product.old_price;
    let qty = r.qty as number;
    let available = product.visible === 1 && product.price !== null && product.stock > 0;
    let note: string | undefined;
    if (!available) note = 'Нет в наличии';
    else if (qty > product.stock) {
      note = `Осталось ${product.stock} шт.`;
      qty = wholesale ? Math.floor(product.stock / product.box_qty) * product.box_qty : product.stock;
      if (!qty) {
        available = false;
        note = 'Нет в наличии';
      }
    }
    const box = wholesale ? Math.max(1, product.box_qty) : 1;
    return {
      product,
      qty,
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
      total: price * qty,
      oldTotal: oldPrice && oldPrice > price ? oldPrice * qty : null,
      boxes: Math.ceil(qty / box),
      available,
      note,
    };
  });
  const ok = lines.filter((l) => l.available);
  const itemsTotal = ok.reduce((a, l) => a + l.total, 0);
  const oldTotal = ok.reduce((a, l) => a + (l.oldTotal ?? l.total), 0);
  const cart: Cart = {
    mode,
    lines,
    count: ok.reduce((a, l) => a + l.qty, 0),
    positions: ok.length,
    boxes: ok.reduce((a, l) => a + l.boxes, 0),
    itemsTotal,
    oldTotal,
    savings: oldTotal - itemsTotal,
    discount: 0,
    total: itemsTotal,
    hash: crypto.createHash('sha1').update(ok.map((l) => `${l.product.id}:${l.qty}:${l.price}`).join('|')).digest('hex'),
  };
  if (mode === 'retail' && locals.sid) {
    const code = db.value<string>('select promo_code from sessions where id = ?', locals.sid);
    if (code && ok.length) {
      const r = evaluatePromo(code, itemsTotal, promoCustomerKeys(locals));
      cart.promoCode = code;
      cart.promo = r.promo;
      cart.promoError = r.error;
      cart.promoLabel = r.promo ? promoLabel(r.promo) : undefined;
      cart.discount = r.discount;
      cart.total = itemsTotal - r.discount;
    }
  }
  return cart;
}

/** Количество для значка в шапке. */
export function cartCount(locals: App.Locals): number {
  const owner = ownerKey(locals);
  if (!owner) return 0;
  const mode = cartMode(locals);
  if (mode === 'b2b') return db.value<number>('select count(*) from cart_items where owner = ? and mode = ?', owner, mode) || 0;
  return (
    db.value<number>(
      `select coalesce(sum(ci.qty), 0) from cart_items ci join products p on p.id = ci.product_id
       where ci.owner = ? and ci.mode = 'retail' and p.visible = 1 and p.stock > 0`,
      owner,
    ) || 0
  );
}

export function cartQtyMap(locals: App.Locals): Map<number, number> {
  const owner = ownerKey(locals);
  const m = new Map<number, number>();
  if (!owner) return m;
  for (const r of db.all('select product_id, qty from cart_items where owner = ? and mode = ?', owner, cartMode(locals))) m.set(r.product_id, r.qty);
  return m;
}

export function setQty(owner: string, mode: 'retail' | 'b2b', productId: number, qty: number) {
  if (qty <= 0) db.run('delete from cart_items where owner = ? and mode = ? and product_id = ?', owner, mode, productId);
  else
    db.run(
      `insert into cart_items (owner, mode, product_id, qty) values (?, ?, ?, ?)
       on conflict(owner, mode, product_id) do update set qty = excluded.qty`,
      owner, mode, productId, qty,
    );
}

export function clearCart(owner: string, mode: 'retail' | 'b2b') {
  db.run('delete from cart_items where owner = ? and mode = ?', owner, mode);
}
