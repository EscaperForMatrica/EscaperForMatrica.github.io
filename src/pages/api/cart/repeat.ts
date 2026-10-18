import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, int } from '../../../lib/http';
import { getOrder, canView } from '../../../lib/orders';
import { ensureSession, ownerKey, cartMode } from '../../../lib/session';
import { productById } from '../../../lib/catalog';
import { setQty } from '../../../lib/cart';

// «Повторить заказ»: кладём в корзину позиции, которые есть в наличии.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const o = getOrder(int(b.orderId));
  if (!o || !canView(o, locals)) return fail('Заказ не найден', 404);
  ensureSession(cookies, locals);
  const owner = ownerKey(locals)!;
  const mode = cartMode(locals);
  let added = 0;
  for (const it of db.all('select product_id, qty from order_items where order_id = ?', o.id)) {
    const p = it.product_id ? productById(it.product_id) : undefined;
    if (!p || !p.available) continue;
    const step = mode === 'b2b' ? Math.max(1, p.box_qty) : 1;
    const cur = db.value<number>('select qty from cart_items where owner = ? and mode = ? and product_id = ?', owner, mode, p.id) || 0;
    let qty = Math.min(p.stock, cur + it.qty);
    qty = Math.floor(qty / step) * step;
    if (qty > 0) {
      setQty(owner, mode, p.id, qty);
      added++;
    }
  }
  if (!added) return fail('Товаров из этого заказа сейчас нет в наличии');
  return json({ ok: true, redirect: mode === 'b2b' ? '/b2b/checkout' : '/cart' });
};
