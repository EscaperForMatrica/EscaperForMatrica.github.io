import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, fail, body, str, bool } from '../../lib/http';
import { getCart } from '../../lib/cart';
import { ensureSession, cartMode } from '../../lib/session';
import { normPhone, isEmail } from '../../lib/format';
import { getPoint, findCity, deliveryCost, deliveryEta } from '../../lib/delivery';
import { upsertPendingOrder } from '../../lib/orders';

// Розничное оформление: создаёт (или обновляет) заказ «ожидает оплаты» и отдаёт его номер для выбора способа оплаты.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (cartMode(locals) === 'b2b') return fail('Для компании оформление — в оптовом кабинете');
  ensureSession(cookies, locals);
  const b = await body(request);
  const name = str(b.name, 120);
  const email = str(b.email, 120).toLowerCase();
  const phone = normPhone(str(b.phone, 40));
  if (name.split(/\s+/).filter(Boolean).length < 2) return fail('Укажите фамилию и имя получателя', 400, { field: 'name' });
  if (!isEmail(email)) return fail('Проверьте адрес почты', 400, { field: 'email' });
  if (!phone) return fail('Проверьте номер телефона', 400, { field: 'phone' });
  if (!bool(b.offer) || !bool(b.pd)) return fail('Нужно принять условия оферты и дать согласие на обработку данных', 400, { field: bool(b.offer) ? 'pd' : 'offer' });

  const type = b.delivery_type === 'wb' ? 'wb' : 'ozon';
  let city = '';
  let pvzId = '';
  let address = '';
  let hours = '';
  if (type === 'ozon') {
    const p = getPoint(str(b.pvz_id, 40));
    if (!p) return fail('Выберите пункт выдачи Ozon', 400, { field: 'pvz' });
    city = p.city;
    pvzId = p.id;
    address = p.address;
    hours = p.hours;
  } else {
    address = str(b.wb_address, 300);
    if (address.length < 10) return fail('Укажите адрес пункта выдачи Wildberries', 400, { field: 'wb' });
    city = findCity(address.split(',')[0]) || '';
  }

  const cart = getCart(locals);
  if (!cart.count) return fail('Корзина пуста — добавьте товары', 400);
  const pvz = pvzId ? getPoint(pvzId) : undefined;
  const cost = deliveryCost(type, pvz);
  const orderId = upsertPendingOrder(locals, cart, {
    name, phone, email, deliveryType: type, city, pvzId, pvzAddress: address, pvzHours: hours,
    deliveryCost: cost, deliveryEta: deliveryEta(type, pvz), newsletter: bool(b.newsletter),
  });

  if (locals.user) {
    const u = locals.user;
    db.run(
      `update users set name = case when name = '' then ? else name end, email = case when email = '' then ? else email end,
       offer_accepted_at = coalesce(offer_accepted_at, datetime('now')), pd_consent_at = coalesce(pd_consent_at, datetime('now')),
       newsletter = ? where id = ?`,
      name, email, bool(b.newsletter) ? 1 : 0, u.id,
    );
  }
  return json({ ok: true, orderId, total: cart.total + cost, count: cart.count });
};
