import { db } from './db';

// Цифры для «Обзора» админки. Выручка — оплаченные заказы (без «ожидает оплаты» и отменённых), даты по Москве.

const PAID = `status not in ('pending', 'cancelled')`;
const MSK = `'+3 hours'`;

export interface Period {
  days: number;
  label: string;
}

export const PERIODS: Record<string, Period> = {
  '7': { days: 7, label: '7 дней' },
  '30': { days: 30, label: '30 дней' },
  '90': { days: 90, label: '90 дней' },
};

function range(daysAgoFrom: number, daysAgoTo: number) {
  return { from: `date('now', ${MSK}, '-${daysAgoFrom - 1} days')`, to: `date('now', ${MSK}, '-${daysAgoTo} days')` };
}

export function summary(days: number) {
  const cur = range(days, 0);
  const prev = range(days * 2, days);
  const q = (r: { from: string; to: string }) =>
    db.get<{ revenue: number; orders: number }>(
      `select coalesce(sum(total), 0) as revenue, count(*) as orders from orders
       where ${PAID} and date(coalesce(paid_at, created_at), ${MSK}) between ${r.from} and ${r.to}`,
    )!;
  const c = q(cur);
  const p = q(prev);
  const customers = db.value<number>(`select count(*) from users where role != 'admin' and date(created_at, ${MSK}) >= ${cur.from}`) || 0;
  const prevCustomers = db.value<number>(`select count(*) from users where role != 'admin' and date(created_at, ${MSK}) >= ${prev.from} and date(created_at, ${MSK}) < ${cur.from}`) || 0;
  return {
    revenue: c.revenue,
    orders: c.orders,
    avg: c.orders ? Math.round(c.revenue / c.orders) : 0,
    customers,
    prev: { revenue: p.revenue, orders: p.orders, avg: p.orders ? Math.round(p.revenue / p.orders) : 0, customers: prevCustomers },
  };
}

export interface Bucket {
  key: string;
  label: string;
  title: string;
  revenue: number;
  orders: number;
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Выручка по дням (до 30 дней) или по неделям (90 дней). */
export function revenueSeries(days: number): Bucket[] {
  const rows = db.all<{ d: string; revenue: number; orders: number }>(
    `select date(coalesce(paid_at, created_at), ${MSK}) as d, sum(total) as revenue, count(*) as orders from orders
     where ${PAID} and date(coalesce(paid_at, created_at), ${MSK}) >= date('now', ${MSK}, '-${days - 1} days')
     group by d`,
  );
  const byDay = new Map(rows.map((r) => [r.d, r]));
  const today = db.value<string>(`select date('now', ${MSK})`)!;
  const base = new Date(today + 'T00:00:00Z');
  const daysList: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 864e5);
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    const label = `${d.getUTCDate()}`;
    daysList.push({ key, label, title: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, revenue: r?.revenue || 0, orders: r?.orders || 0 });
  }
  if (days <= 30) return daysList;
  const weeks: Bucket[] = [];
  for (let i = 0; i < daysList.length; i += 7) {
    const chunk = daysList.slice(i, i + 7);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    weeks.push({
      key: first.key,
      label: first.title.split(' ')[0] + ' ' + first.title.split(' ')[1],
      title: `${first.title} – ${last.title}`,
      revenue: chunk.reduce((a, b) => a + b.revenue, 0),
      orders: chunk.reduce((a, b) => a + b.orders, 0),
    });
  }
  return weeks;
}

export function attention() {
  return {
    toAssemble: db.value<number>(`select count(*) from orders where status = 'paid'`) || 0,
    noTrack: db.value<number>(`select count(*) from orders where track = '' and status in ('paid', 'assembling', 'shipping')`) || 0,
    invoices: db.value<number>(`select count(*) from orders where status = 'pending' and payment_method = 'invoice'`) || 0,
    lowStock: db.value<number>(`select count(*) from products where visible = 1 and stock < 10`) || 0,
    pvz: db.value<number>(`select count(*) from orders where status = 'pvz'`) || 0,
  };
}

export function topProducts(days: number, limit = 6) {
  return db.all<{ product_id: number; name: string; variant: string; qty: number; revenue: number }>(
    `select oi.product_id, oi.name, oi.variant, sum(oi.qty) as qty, sum(oi.qty * oi.price) as revenue
     from order_items oi join orders o on o.id = oi.order_id
     where o.status not in ('pending', 'cancelled') and date(coalesce(o.paid_at, o.created_at), ${MSK}) >= date('now', ${MSK}, '-${days - 1} days')
     group by oi.product_id, oi.name, oi.variant order by revenue desc limit ?`,
    limit,
  );
}

/** Изменение к прошлому периоду в процентах (null — сравнивать не с чем). */
export function delta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

/** «Красивый» максимум оси: 1 / 2 / 5 × 10^n. */
export function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`.replace('.', ',');
  if (n >= 1000) return `${+(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`.replace('.', ',');
  return String(n);
}
