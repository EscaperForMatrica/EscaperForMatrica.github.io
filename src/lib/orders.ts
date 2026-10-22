import { db } from './db';
import type { Cart } from './cart';
import { clearCart } from './cart';
import { smallUrl } from './images';

export type OrderStatus = 'pending' | 'paid' | 'assembling' | 'shipping' | 'pvz' | 'received' | 'cancelled';

export const STATUS: Record<OrderStatus, { label: string; cls: string; icon: string }> = {
  pending: { label: 'Ожидает оплаты', cls: 'pl-badge--neutral is-pending', icon: 'clock' },
  paid: { label: 'Оплачен', cls: 'pl-status--paid', icon: 'coin' },
  assembling: { label: 'Собирается', cls: 'pl-status--assembling', icon: 'box' },
  shipping: { label: 'Передан в доставку', cls: 'pl-status--shipping', icon: 'truck' },
  pvz: { label: 'Ждёт в ПВЗ', cls: 'pl-status--pvz', icon: 'store' },
  received: { label: 'Получен', cls: 'pl-status--received', icon: 'check' },
  cancelled: { label: 'Отменён', cls: 'pl-status--cancelled', icon: 'close' },
};

/** Статусы, которые админ выбирает в карточке заказа (по порядку жизненного цикла). */
export const FLOW: OrderStatus[] = ['pending', 'paid', 'assembling', 'shipping', 'pvz', 'received', 'cancelled'];
export const ACTIVE: OrderStatus[] = ['pending', 'paid', 'assembling', 'shipping', 'pvz'];

export interface Order {
  id: number;
  kind: 'retail' | 'b2b';
  status: OrderStatus;
  user_id: number | null;
  company_id: number | null;
  session_id: string | null;
  name: string;
  phone: string;
  email: string;
  delivery_type: 'ozon' | 'wb';
  city: string;
  pvz_id: string;
  pvz_address: string;
  pvz_hours: string;
  delivery_cost: number;
  delivery_eta: string;
  items_total: number;
  old_total: number;
  discount: number;
  promo_code: string | null;
  total: number;
  payment_method: string;
  newsletter: number;
  track: string;
  storage_until: string | null;
  paid_at: string | null;
  received_at: string | null;
  cart_hash: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  variant: string;
  image: string;
  price: number;
  old_price: number | null;
  qty: number;
  box_qty: number;
  img: string;
  slug?: string;
}

export const PAY_METHOD: Record<string, string> = {
  card: 'Банковская карта',
  sbp: 'СБП',
  invoice: 'Счёт на юрлицо',
};

export function getOrder(id: number): Order | undefined {
  return db.get<Order>('select * from orders where id = ?', id);
}

export function orderItems(id: number): OrderItem[] {
  return db
    .all<OrderItem>('select oi.*, p.slug from order_items oi left join products p on p.id = oi.product_id where oi.order_id = ? order by oi.id', id)
    .map((i) => ({ ...i, img: smallUrl(i.image) }));
}

export function orderEvents(id: number) {
  return db.all<{ status: OrderStatus; at: string }>('select status, at from order_events where order_id = ? order by at, id', id);
}

export function itemsCount(id: number): number {
  return db.value<number>('select coalesce(sum(qty), 0) from order_items where order_id = ?', id) || 0;
}

export function positionsCount(id: number): number {
  return db.value<number>('select count(*) from order_items where order_id = ?', id) || 0;
}

/** Доступ к заказу: владелец-пользователь, сессия оформления или админ. */
export function canView(o: Order, locals: App.Locals): boolean {
  if (locals.user?.role === 'admin') return true;
  if (o.user_id && locals.user?.id === o.user_id) return true;
  if (o.company_id && locals.user?.company_id === o.company_id) return true;
  return Boolean(o.session_id && locals.sid && o.session_id === locals.sid);
}

export interface CheckoutData {
  name: string;
  phone: string;
  email: string;
  deliveryType: 'ozon' | 'wb';
  city: string;
  pvzId: string;
  pvzAddress: string;
  pvzHours: string;
  deliveryCost: number;
  deliveryEta: string;
  newsletter: boolean;
  paymentMethod?: string;
}

/**
 * Создаёт заказ «ожидает оплаты» из корзины. Если в этой сессии уже есть неоплаченный
 * заказ — перезаписывает его, чтобы повторные нажатия «Оплатить» не плодили дубли.
 */
export function upsertPendingOrder(locals: App.Locals, cart: Cart, d: CheckoutData): number {
  const kind = cart.mode;
  return db.tx(() => {
    const existing = db.get<{ id: number }>(
      `select id from orders where status = 'pending' and kind = ? and session_id = ? and payment_method != 'invoice'
       and created_at > datetime('now', '-2 days') order by id desc limit 1`,
      kind, locals.sid,
    );
    const values = [
      kind, locals.user?.id ?? null, locals.company?.id ?? null, locals.sid, d.name, d.phone, d.email, d.deliveryType, d.city, d.pvzId,
      d.pvzAddress, d.pvzHours, d.deliveryCost, d.deliveryEta, cart.itemsTotal, cart.oldTotal, cart.discount,
      cart.discount ? cart.promo?.code ?? null : null, cart.total + d.deliveryCost, d.paymentMethod || '', d.newsletter ? 1 : 0, cart.hash,
    ];
    let id: number;
    if (existing) {
      id = existing.id;
      db.run(
        `update orders set kind=?, user_id=?, company_id=?, session_id=?, name=?, phone=?, email=?, delivery_type=?, city=?, pvz_id=?, pvz_address=?,
         pvz_hours=?, delivery_cost=?, delivery_eta=?, items_total=?, old_total=?, discount=?, promo_code=?, total=?, payment_method=?, newsletter=?,
         cart_hash=?, updated_at=datetime('now') where id = ?`,
        ...values, id,
      );
      db.run('delete from order_items where order_id = ?', id);
    } else {
      id = Number(
        db.run(
          `insert into orders (kind, user_id, company_id, session_id, name, phone, email, delivery_type, city, pvz_id, pvz_address, pvz_hours,
           delivery_cost, delivery_eta, items_total, old_total, discount, promo_code, total, payment_method, newsletter, cart_hash, status)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
          ...values,
        ).lastInsertRowid,
      );
      db.run(`insert into order_events (order_id, status) values (?, 'pending')`, id);
    }
    for (const l of cart.lines.filter((x) => x.available)) {
      db.run(
        'insert into order_items (order_id, product_id, name, variant, image, price, old_price, qty, box_qty) values (?,?,?,?,?,?,?,?,?)',
        id, l.product.id, l.product.name, l.product.variant, l.product.images[0] || '', l.price, l.oldPrice, l.qty, kind === 'b2b' ? l.product.box_qty : 1,
      );
    }
    return id;
  });
}

function cartOwnerOf(o: Order): string | null {
  if (o.user_id) return `u:${o.user_id}`;
  if (o.session_id) return `s:${o.session_id}`;
  return null;
}

/** Оплата подтверждена: списываем остатки, учитываем промокод, очищаем корзину. Идемпотентно. */
export function markPaid(orderId: number, method: string) {
  db.tx(() => {
    const o = getOrder(orderId);
    if (!o || o.status !== 'pending') return;
    db.run(`update orders set status = 'paid', payment_method = ?, paid_at = datetime('now'), updated_at = datetime('now') where id = ?`, method, orderId);
    db.run(`insert into order_events (order_id, status) values (?, 'paid')`, orderId);
    reserveStock(orderId);
    if (o.promo_code && o.discount > 0) {
      const promo = db.get<{ id: number }>('select id from promo_codes where code = ?', o.promo_code);
      if (promo) {
        db.run('update promo_codes set used = used + 1 where id = ?', promo.id);
        const who = o.user_id ? `u:${o.user_id}` : o.phone;
        db.run('insert or ignore into promo_uses (promo_id, customer, order_id) values (?, ?, ?)', promo.id, who, orderId);
        if (o.user_id) db.run('insert or ignore into promo_uses (promo_id, customer, order_id) values (?, ?, ?)', promo.id, o.phone, -orderId);
      }
    }
    const owner = cartOwnerOf(o);
    if (owner) clearCart(owner, o.kind);
    if (o.session_id) db.run('update sessions set promo_code = null where id = ?', o.session_id);
  });
}

function reserveStock(orderId: number) {
  for (const it of db.all('select product_id, qty from order_items where order_id = ?', orderId)) {
    if (!it.product_id) continue;
    db.run('update products set stock = max(0, stock - ?), sales = sales + ? where id = ?', it.qty, it.qty, it.product_id);
  }
}

/** Счёт выставлен (опт): заказ ждёт оплаты, корзина очищается сразу. */
export function placeInvoiceOrder(orderId: number) {
  db.tx(() => {
    const o = getOrder(orderId);
    if (!o) return;
    db.run(`update orders set payment_method = 'invoice', updated_at = datetime('now') where id = ?`, orderId);
    if (!db.value('select 1 from documents where order_id = ? and kind = ?', orderId, 'invoice')) {
      db.run(`insert into documents (order_id, kind, number) values (?, 'invoice', ?)`, orderId, String(orderId));
    }
    const owner = cartOwnerOf(o);
    if (owner) clearCart(owner, o.kind);
  });
}

export function setStatus(orderId: number, status: OrderStatus) {
  db.tx(() => {
    const o = getOrder(orderId);
    if (!o || o.status === status) return;
    if (o.status === 'pending' && status !== 'cancelled') {
      // Оплата по счёту поступила (опт) или подтверждена вручную
      db.run(`update orders set paid_at = coalesce(paid_at, datetime('now')) where id = ?`, orderId);
      reserveStock(orderId);
      if (status !== 'paid') db.run(`insert into order_events (order_id, status) values (?, 'paid')`, orderId);
    }
    db.run(`update orders set status = ?, updated_at = datetime('now') where id = ?`, status, orderId);
    if (status === 'pvz') db.run(`update orders set storage_until = coalesce(storage_until, date('now', '+7 days')) where id = ?`, orderId);
    if (status === 'received') db.run(`update orders set received_at = datetime('now') where id = ?`, orderId);
    db.run('insert into order_events (order_id, status) values (?, ?)', orderId, status);
  });
}

export function setTrack(orderId: number, track: string) {
  db.run(`update orders set track = ?, updated_at = datetime('now') where id = ?`, track.trim(), orderId);
}

export function userOrders(locals: App.Locals, filter: 'all' | 'active' | 'received' = 'all'): Order[] {
  if (!locals.user) return [];
  const where = locals.company ? 'company_id = ?' : 'user_id = ?';
  const who = locals.company ? locals.company.id : locals.user.id;
  let extra = ` and not (status = 'pending' and payment_method != 'invoice')`;
  if (filter === 'active') extra += ` and status in ('pending','paid','assembling','shipping','pvz')`;
  if (filter === 'received') extra += ` and status = 'received'`;
  // Сначала то, что требует действий покупателя: забрать из ПВЗ, оплатить счёт; затем в пути и в сборке
  const prio = `case status when 'pvz' then 0 when 'pending' then 1 when 'shipping' then 2 when 'assembling' then 3 when 'paid' then 4 else 5 end`;
  return db.all<Order>(`select * from orders where ${where}${extra} order by ${prio}, created_at desc, id desc`, who);
}

export function orderCounts(locals: App.Locals) {
  if (!locals.user) return { all: 0, active: 0, received: 0 };
  const where = locals.company ? 'company_id = ?' : 'user_id = ?';
  const who = locals.company ? locals.company.id : locals.user.id;
  const r = db.get<any>(
    `select count(*) as a, sum(status in ('pending','paid','assembling','shipping','pvz')) as act, sum(status = 'received') as rec
     from orders where ${where} and not (status = 'pending' and payment_method != 'invoice')`,
    who,
  );
  return { all: r?.a || 0, active: r?.act || 0, received: r?.rec || 0 };
}

export function documentsFor(orderId: number) {
  return db.all<{ id: number; order_id: number; kind: string; number: string; file: string; created_at: string }>('select * from documents where order_id = ? order by id', orderId);
}

export const DOC_LABEL: Record<string, string> = { invoice: 'Счёт', upd: 'УПД', receipt: 'Кассовый чек', act: 'Акт' };
