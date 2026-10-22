import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, bool } from '../../../lib/http';
import { getCart } from '../../../lib/cart';
import { normPhone, isEmail } from '../../../lib/format';
import { chosenDelivery, deliveryCost, deliveryEta } from '../../../lib/delivery';
import { upsertPendingOrder, placeInvoiceOrder } from '../../../lib/orders';
import { notifyInvoice } from '../../../lib/notify';

// Оптовое оформление: счёт на юрлицо (заказ ждёт оплаты) или онлайн-оплата картой/СБП.
export const POST: APIRoute = async ({ request, locals }) => {
  const { user, company } = locals;
  if (!user || !company) return fail('Войдите в оптовый кабинет', 401);
  const b = await body(request);
  const name = str(b.name, 120);
  const email = str(b.email, 120).toLowerCase();
  const phone = normPhone(str(b.phone, 40));
  if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите контактное лицо', 400, { field: 'name' });
  if (!phone) return fail('Проверьте номер телефона', 400, { field: 'phone' });
  if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
  if (!bool(b.offer) || !bool(b.pd)) return fail('Нужно принять условия оферты и дать согласие на обработку данных', 400);

  const cart = getCart(locals, 'b2b');
  if (!cart.count) return fail('В заказе нет товаров');
  const d = chosenDelivery(b);
  if (!d.ok) return fail(d.error, 400, { field: d.field });

  const cost = deliveryCost(d.type, cart.boxes);
  const invoice = b.payment !== 'card';
  const orderId = upsertPendingOrder(locals, cart, {
    name, phone, email, deliveryType: d.type, city: '', pvzId: d.pvzId, pvzAddress: d.address, pvzHours: d.hours,
    deliveryCost: cost, deliveryEta: deliveryEta(d.type), newsletter: bool(b.newsletter),
    paymentMethod: invoice ? 'invoice' : '',
  });
  db.run(`update users set newsletter = ?, pd_consent_at = coalesce(pd_consent_at, datetime('now')), offer_accepted_at = coalesce(offer_accepted_at, datetime('now')) where id = ?`, bool(b.newsletter) ? 1 : 0, user.id);
  if (!user.email) db.run('update users set email = ? where id = ?', email, user.id);

  if (invoice) {
    placeInvoiceOrder(orderId);
    notifyInvoice(orderId);
    return json({ ok: true, redirect: `/b2b/account?invoice=${orderId}` });
  }
  return json({ ok: true, orderId, total: cart.itemsTotal + cost, count: cart.count });
};
