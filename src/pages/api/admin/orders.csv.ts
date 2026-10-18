import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { STATUS, PAY_METHOD } from '../../../lib/orders';

// Выгрузка заказов в CSV (Excel открывает с разделителем «;» и BOM)
export const GET: APIRoute = ({ url }) => {
  const where: string[] = [];
  const params: any[] = [];
  const d = url.searchParams.get('d');
  const s = url.searchParams.get('s');
  const m = url.searchParams.get('m');
  if (d === 'ozon' || d === 'wb') { where.push('o.delivery_type = ?'); params.push(d); }
  if (s && s in STATUS) { where.push('o.status = ?'); params.push(s); }
  if (m) { where.push(`strftime('%Y-%m', o.created_at) = ?`); params.push(m); }
  const rows = db.all(
    `select o.*, c.name as company, c.inn as inn,
      (select group_concat(name || ', ' || variant || ' × ' || qty, ' | ') from order_items where order_id = o.id) as items
     from orders o left join companies c on c.id = o.company_id ${where.length ? 'where ' + where.join(' and ') : ''} order by o.id desc`,
    ...params,
  );
  const head = ['№', 'Дата (UTC)', 'Статус', 'Тип', 'Компания', 'ИНН', 'Покупатель', 'Телефон', 'Email', 'Доставка', 'Адрес ПВЗ', 'Трек-номер', 'Товары', 'Сумма товаров', 'Скидка', 'Промокод', 'Доставка, ₽', 'Итого', 'Оплата'];
  const esc = (v: unknown) => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = rows.map((r) => [
    r.id, r.created_at, STATUS[r.status as keyof typeof STATUS]?.label, r.kind === 'b2b' ? 'опт' : 'розница', r.company, r.inn, r.name, '+' + r.phone, r.email,
    r.delivery_type === 'wb' ? 'Wildberries' : 'Ozon', r.pvz_address, r.track, r.items, r.items_total, r.discount, r.promo_code, r.delivery_cost, r.total, PAY_METHOD[r.payment_method] || '',
  ].map(esc).join(';'));
  const csv = '﻿' + [head.join(';'), ...lines].join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="palada-orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
};
