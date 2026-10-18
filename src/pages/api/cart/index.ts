import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, int, str } from '../../../lib/http';
import { ensureSession, ownerKey, cartMode } from '../../../lib/session';
import { setQty, clearCart, cartCount, getCart } from '../../../lib/cart';
import { productById } from '../../../lib/catalog';
import { evaluatePromo, normCode, promoLabel } from '../../../lib/promo';
import { promoCustomerKeys } from '../../../lib/cart';

// Корзина покупателя: add | set | remove | clear | promo | promo-remove
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = await body(request);
  const action = str(b.action, 20);
  ensureSession(cookies, locals);
  const owner = ownerKey(locals)!;
  const mode = cartMode(locals);

  if (action === 'add' || action === 'set') {
    const p = productById(int(b.id));
    if (!p || !p.visible || p.price === null) return fail('Товар не найден', 404);
    if (p.stock <= 0) return fail('Товара нет в наличии');
    const step = mode === 'b2b' ? Math.max(1, p.box_qty) : 1;
    const current = db.value<number>('select qty from cart_items where owner = ? and mode = ? and product_id = ?', owner, mode, p.id) || 0;
    let qty = action === 'add' ? current + Math.max(1, int(b.qty, 1)) * (mode === 'b2b' && b.unit !== 'pcs' ? step : 1) : Math.max(0, int(b.qty));
    if (mode === 'b2b') qty = Math.round(qty / step) * step;
    let note: string | undefined;
    if (qty > p.stock) {
      qty = mode === 'b2b' ? Math.floor(p.stock / step) * step : p.stock;
      note = `Можно заказать не больше ${p.stock} шт.`;
    }
    qty = Math.min(qty, 999);
    setQty(owner, mode, p.id, qty);
    return json({ ok: true, qty, note, count: cartCount(locals) });
  }

  if (action === 'remove') {
    setQty(owner, mode, int(b.id), 0);
    return json({ ok: true, count: cartCount(locals) });
  }

  if (action === 'clear') {
    clearCart(owner, mode);
    return json({ ok: true, count: 0 });
  }

  if (action === 'promo') {
    const code = normCode(str(b.code, 40));
    if (!code) return fail('Введите промокод');
    const cart = getCart(locals);
    const r = evaluatePromo(code, cart.itemsTotal, promoCustomerKeys(locals));
    if (!r.promo || r.error) return fail(r.error || 'Промокод недействителен', 400, { field: 'promo' });
    db.run('update sessions set promo_code = ? where id = ?', code, locals.sid);
    return json({ ok: true, code, label: promoLabel(r.promo), discount: r.discount });
  }

  if (action === 'promo-remove') {
    db.run('update sessions set promo_code = null where id = ?', locals.sid);
    return json({ ok: true });
  }

  return fail('Неизвестное действие');
};
