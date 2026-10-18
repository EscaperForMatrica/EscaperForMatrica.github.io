import crypto from 'node:crypto';
import { db } from './db';
import { config, paymentsLive, isProd } from './config';
import { getOrder, orderItems, markPaid, type Order } from './orders';

// Платежи. Боевой провайдер — ЮKassa (карта и СБП, редирект на защищённую страницу).
// Без ключей включается тестовая страница /pay/test — только для разработки.

export type PayMethod = 'card' | 'sbp';

export interface Payment {
  id: number;
  order_id: number;
  provider: string;
  external_id: string;
  method: PayMethod;
  amount: number;
  status: 'pending' | 'succeeded' | 'canceled';
  created_at: string;
}

export function lastPayment(orderId: number): Payment | undefined {
  return db.get<Payment>('select * from payments where order_id = ? order by id desc limit 1', orderId);
}

export function getPayment(id: number): Payment | undefined {
  return db.get<Payment>('select * from payments where id = ?', id);
}

function auth() {
  return 'Basic ' + Buffer.from(`${config.yookassa.shopId}:${config.yookassa.secretKey}`).toString('base64');
}

function receipt(o: Order) {
  const items = orderItems(o.id);
  const lines: any[] = items.map((i) => ({
    description: `${i.name}, ${i.variant}`.slice(0, 128),
    quantity: String(i.qty),
    amount: { value: i.price.toFixed(2), currency: 'RUB' },
    vat_code: config.yookassa.vatCode,
    payment_mode: 'full_payment',
    payment_subject: 'commodity',
  }));
  // Скидку по промокоду распределяем на первую позицию (ЮKassa требует сумму чека = сумме платежа)
  if (o.discount > 0 && lines.length) {
    let left = o.discount;
    for (const l of lines) {
      const sum = Number(l.amount.value) * Number(l.quantity);
      const cut = Math.min(left, sum - Number(l.quantity));
      if (cut <= 0) continue;
      l.amount.value = ((sum - cut) / Number(l.quantity)).toFixed(2);
      left -= cut;
      if (left <= 0) break;
    }
  }
  if (o.delivery_cost > 0) {
    lines.push({ description: 'Доставка', quantity: '1', amount: { value: o.delivery_cost.toFixed(2), currency: 'RUB' }, vat_code: config.yookassa.vatCode, payment_mode: 'full_payment', payment_subject: 'service' });
  }
  return { customer: { email: o.email || undefined, phone: o.phone || undefined }, items: lines };
}

/** Создаёт платёж и возвращает URL, куда отправить покупателя. */
export async function startPayment(order: Order, method: PayMethod, origin: string): Promise<string> {
  const base = config.siteUrl || origin;
  if (!paymentsLive() && isProd && !config.demo) throw new Error('Онлайн-оплата пока не подключена. Напишите нам в WhatsApp — поможем оформить заказ.');
  if (!paymentsLive()) {
    const id = Number(db.run('insert into payments (order_id, provider, method, amount) values (?, ?, ?, ?)', order.id, 'test', method, order.total).lastInsertRowid);
    return `/pay/test?payment=${id}`;
  }
  const local = Number(db.run('insert into payments (order_id, provider, method, amount) values (?, ?, ?, ?)', order.id, 'yookassa', method, order.total).lastInsertRowid);
  const body: any = {
    amount: { value: order.total.toFixed(2), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: `${base}/order/${order.id}?payment=${local}` },
    payment_method_data: { type: method === 'sbp' ? 'sbp' : 'bank_card' },
    description: `Заказ № ${order.id} в PALADA`,
    metadata: { order_id: String(order.id), payment_id: String(local) },
  };
  if (config.yookassa.receipts) body.receipt = receipt(order);
  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: { Authorization: auth(), 'Idempotence-Key': crypto.randomUUID(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.confirmation?.confirmation_url) {
    db.run(`update payments set status = 'canceled', updated_at = datetime('now') where id = ?`, local);
    console.error('[yookassa] create payment failed', res.status, data);
    throw new Error('Платёжный сервис временно недоступен. Попробуйте ещё раз или напишите нам.');
  }
  db.run('update payments set external_id = ? where id = ?', data.id, local);
  return data.confirmation.confirmation_url;
}

/** Проверка статуса у ЮKassa (после возврата покупателя и из вебхука). */
export async function syncPayment(p: Payment): Promise<Payment['status']> {
  if (p.provider !== 'yookassa' || !p.external_id || p.status !== 'pending') return p.status;
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${p.external_id}`, { headers: { Authorization: auth() } });
  if (!res.ok) return p.status;
  const data: any = await res.json();
  if (data.status === 'succeeded') return settle(p.id, 'succeeded');
  if (data.status === 'canceled') return settle(p.id, 'canceled');
  return 'pending';
}

export function settle(paymentId: number, status: 'succeeded' | 'canceled'): Payment['status'] {
  const p = getPayment(paymentId);
  if (!p || p.status !== 'pending') return p?.status ?? 'canceled';
  db.run(`update payments set status = ?, updated_at = datetime('now') where id = ?`, status, paymentId);
  if (status === 'succeeded') markPaid(p.order_id, p.method);
  return status;
}

export function paymentOrder(p: Payment) {
  return getOrder(p.order_id);
}
