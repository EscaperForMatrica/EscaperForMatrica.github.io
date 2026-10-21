import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, fail, body, str, int } from '../../../lib/http';
import { getOrder, setStatus, setTrack, STATUS, type OrderStatus } from '../../../lib/orders';
import { notifyTrack, notifyOrderPaid } from '../../../lib/notify';

// Заказы в админке: status | track | doc
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  const o = getOrder(int(b.id));
  if (!o) return fail('Заказ не найден', 404);

  if (b.action === 'track') {
    const track = str(b.track, 60);
    setTrack(o.id, track);
    // Трек указан у оплаченного/собираемого заказа — переводим в «Передан в доставку»
    if (track && ['paid', 'assembling'].includes(o.status)) setStatus(o.id, 'shipping');
    if (track && track !== o.track) notifyTrack(o.id);
    return json({ ok: true });
  }
  if (b.action === 'status') {
    const status = str(b.status, 20) as OrderStatus;
    if (!(status in STATUS)) return fail('Неизвестный статус');
    if (['shipping', 'pvz'].includes(status) && !o.track) return fail('Сначала укажите трек-номер — покупатель увидит его в кабинете');
    setStatus(o.id, status);
    // Оплата по счёту подтверждена вручную — письмо покупателю и магазину
    if (o.status === 'pending' && status !== 'cancelled') notifyOrderPaid(o.id);
    return json({ ok: true });
  }
  if (b.action === 'doc') {
    const file = str(b.file, 200);
    if (!file.startsWith('/uploads/docs/')) return fail('Файл не загружен');
    const kind = ['upd', 'act', 'invoice', 'receipt'].includes(b.kind) ? b.kind : 'upd';
    db.run('insert into documents (order_id, kind, number, file) values (?, ?, ?, ?)', o.id, kind, String(o.id), file);
    return json({ ok: true });
  }
  return fail('Неизвестное действие');
};
